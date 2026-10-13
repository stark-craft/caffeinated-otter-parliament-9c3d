import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,} from 'react'
import QuickBiteLogo from './QuickBiteLogo.jsx'
import PlatformBadge from './PlatformBadge.jsx'
import {
  QUICKBITE_CATEGORIES,
  QUICKBITE_DISHES,} from '../../quickbite/catalog.js'
import {
  cartFromEnvelope,
  chooseMenuItem,
  groceryCardsFromEnvelope,
  imageDataUri,
  menuFromEnvelope,
  money,
  paymentQrFromEnvelope,
  restaurantCardsFromEnvelope,
  safeSubtotal,
  trackingFromEnvelope,} from '../../quickbite/envelopes.js'
import {
  screenForTracking,
  trackingPhase,
  trackingText,} from '../../quickbite/tracking.js'
import { backTarget, recordScreenVisit, takePreviousScreen, editableCartFocusAfterArrow } from '../../quickbite/navigation.js'
import { agentCartEditPrompt, editAgentCartQuantity } from '../../quickbite/agentCart.js'
import { cartClearRequestPrompt, cartReadbackPrompt, verifiedEmptyCart } from '../../quickbite/cartState.js'
import { checkoutActionLabels, checkoutOptionsRequest } from '../../quickbite/checkoutOptions.js'
import { missLabel } from '../../quickbite/missLabels.js'
import { matchedDishLines, notFoundLabel } from '../../quickbite/restaurantMatch.js'
import { routeIntent } from '../../quickbite/intents.js'
import { buildView } from '../../quickbite/viewContext.js'
import ConfirmStrip from './ConfirmStrip.jsx'
import {
  NEW_SCREENS, defaultFocusFor, focusKeysFor, isOrderAction, isCartDestructiveAction, isCheckoutDeclineAction, platformMentioned, screenForEnvelope,} from '../../quickbite/widgetScreens.js'
import TextScreen from './screens/TextScreen.jsx'
import AgentCartScreen from './screens/AgentCartScreen.jsx'
import CompareScreen from './screens/CompareScreen.jsx'
import BasketCompareScreen from './screens/BasketCompareScreen.jsx'
import SpendScreen from './screens/SpendScreen.jsx'
import { GROCERY_CATEGORIES, GROCERY_PRODUCTS } from '../../quickbite/groceryCatalog.js'
import { GROCERY_SHORTCUTS, groceryShortcutRequest, groceryShortcutPrompt, firstMatchingGroceryOffer, isRepeatedResultSummary } from '../../quickbite/groceryShortcut.js'
import { QUICK_PROMPTS, quickPromptAt, modeFocusAfterArrow } from '../../quickbite/quickPrompts.js'
import { HOME_BACKDROP, MODE_TILES } from '../../quickbite/heroArt.js'
import { confirmedCodCheckout, orderPlatform, paymentMethodFromEnvelope, paymentPresentation } from '../../quickbite/payMode.js'
import { voiceError, voiceLog, voiceWarn } from '../../quickbite/voiceDiagnostics.js'
import { PROVIDERS, providerId, responseProviders } from '../../quickbite/providers.js'
import { commerceLog } from '../../quickbite/commerceDiagnostics.js'
const ORDER_SCREENS = new Set([
  'pay',
  'payment-received',
  'preparing',
  'on-the-way',
  'delivered',
  'cancelled',])
const EMPTY_LIST = []
const trailingIndex = (key) =>
  Number(String(key).split('-').pop())
function cleanQuickActionLabel(label = '') {
  return (
    label
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/^(Order|Best)\s+/i, '')
      .trim() || 'Food'
  )}/* * IMPORTANT: * * This mirrors the OLD working Carousel.jsx checkout contract. * * The backend returns: * *
   env.actions * * Every action is rendered to the user. * * When the user chooses an action, the exact action string is passed to: * *
   sendSilent(label) * * We do NOT: * - regex-select an action automatically * - invent a payment method * - invent a checkout prompt * - introduce /api/payment * - modify the backend-provided action string *//* Checkout buttons are supplied by the provider response (including
   payload.actions when top-level actions is empty). */
function paymentDisplayLabel(value) {
  if (value == null || value === '') {
    return ''
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value)
  }
  if (typeof value === 'object') {
    return String(
      value.label ??
      value.name ??
      value.method ??
      value.mode ??
      value.type ??
      value.payment_method ??
      '',
    ).trim()
  }
  return ''}
function Meta({ children }) {
  return children
    ? <span className="qb-meta-pill">{children}</span>
    : null}
function Media({
  src,
  fallback,
  alt,
  className = '',}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        className={`qb-media-fallback ${className}`}
        aria-hidden="true"
      >
        {fallback || '🍝'}
      </div>
    )
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  )}
function CategoryMedia({ category }) {
  const [failed, setFailed] = useState(false)
  if (!category.image || failed) {
    return (
      <span
        className="qb-category-visual"
        style={{
          '--qb-category-accent': category.accent,
        }}
      >
        {category.emoji}
      </span>
    )
  }
  return (
    <img
      className="qb-category-image"
      src={category.image}
      alt={category.name}
      onError={() => setFailed(true)}
      style={{
        '--qb-category-accent': category.accent,
      }}
    />
  )}
function DishMedia({ dish }) {
  const [failed, setFailed] = useState(false)
  if (!dish.image || failed) {
    return (
      <span className="qb-dish-visual">
        {dish.emoji}
      </span>
    )
  }
  return (
    <img
      className="qb-dish-image"
      src={dish.image}
      alt={dish.name}
      onError={() => setFailed(true)}
    />
  )}
function ProgressStepper({ stage }) {
  const index =
    stage === 'track'
      ? 2
      : stage === 'pay'
        ? 1
        : 0
  return (
    <div
      className="qb-progress"
      aria-label={`${stage} stage`}
    >
      {['Review', 'Pay', 'Track'].map(
        (label, itemIndex) => (
          <div
            className="qb-progress-fragment"
            key={label}
          >
            {itemIndex > 0 && (
              <span
                className={`qb-progress-line ${
                  itemIndex <= index
                    ? 'is-done'
                    : ''
                }`}
              />
            )}
            <div
              className={`qb-progress-step ${
                itemIndex < index
                  ? 'is-done'
                  : ''
              } ${
                itemIndex === index
                  ? 'is-current'
                  : ''
              }`}
            >
              <span className="qb-progress-circle">
                {itemIndex < index
                  ? '✓'
                  : itemIndex + 1}
              </span>
              <span>{label}</span>
            </div>
          </div>
        ),
      )}
    </div>
  )}
function TrackingStepper({ phase }) {
  const current =
    phase === 'delivered'
      ? 2
      : phase === 'on-the-way'
        ? 1
        : 0
  return (
    <div
      className="qb-tracking-steps"
      aria-label={`Order stage: ${phase}`}
    >
      {[
        'Preparing',
        'On the way',
        'Delivered',
      ].map((label, index) => (
        <div
          className="qb-track-fragment"
          key={label}
        >
          {index > 0 && (
            <span
              className={`qb-track-line ${
                index <= current
                  ? 'is-done'
                  : ''
              }`}
            />
          )}
          <div
            className={`qb-track-step ${
              index < current
                ? 'is-done'
                : ''
            } ${
              index === current
                ? 'is-current'
                : ''
            }`}
          >
            <span className="qb-track-circle">
              {index < current
                ? '✓'
                : index + 1}
            </span>
            <span>{label}</span>
          </div>
        </div>
      ))}
    </div>
  )}
function LoadingState({ label }) {
  return (
    <div
      className="qb-state-card"
      role="status"
    >
      <span className="qb-spinner" />
      <h3>{label}</h3>
      <p>
        QuickBite is checking the live menu.
      </p>
    </div>
  )}
function ErrorState({
  title,
  detail,
  onRetry,
  focused,
  onFocus,
  retryLabel = 'Retry',}) {
  return (
    <div
      className="qb-state-card qb-state-error"
      role="alert"
    >
      <span className="qb-state-icon">
        !
      </span>
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {onRetry && (
        <button
          data-qb-focus="retry"
          className={`qb-secondary-button ${
            focused ? 'is-focused' : ''
          }`}
          onFocus={onFocus}
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )}
const QuickBitePanel = forwardRef(
  function QuickBitePanel(
    {
      open,
      onClose,
      sessionId,
      activeOrder,
      onClearActiveOrder,
      platforms,
      sendSilent,
      merchantAccess,
      onRequestLogin,
      externalRequest,
      trackingState,
      onPanelState,
      onRetryRequest,
      onQuickPrompt,
    },
    ref,
  ) {
    const panelRef = useRef(null)
    const handleKeyRef = useRef(null)
    const lastVoiceTraceRef = useRef(null)
    const checkoutInFlightRef = useRef(false)
    const quickPromptInFlightRef = useRef(false)
    const widgetModelsRef = useRef({})
    const journeyEpochRef = useRef(0)
    const widgetActionRef = useRef(null)
    const cartEditInFlightRef = useRef(null)
    const shortcutSearchRef = useRef(null)
    const handledShortcutRef = useRef(null)
    const panelOpenRef = useRef(open)
    panelOpenRef.current = open
    const [screen, setScreenState] =
      useState('home')
    const screenRef = useRef('home')
    const screenHistoryRef = useRef([])
    const voicePendingRef = useRef(false)
    const suppressedTrackingPhaseRef = useRef(null)
    screenRef.current = screen
    function setScreen(next, options = {}) {
      const previous = screenRef.current
      if (next === previous) return
      screenHistoryRef.current = recordScreenVisit(screenHistoryRef.current, previous, next, options)
      if (next === 'home') screenHistoryRef.current = []
      screenRef.current = next
      if (NEW_SCREENS.includes(next)) setWidgetModelState(widgetModelsRef.current[next] || null)
      setScreenState(next)
    }
    // Which path the user walked in on. Decides the grocery/food branch on the
    // screens the two paths share — `cart` onward — and nothing else.
    const [vertical, setVertical] = useState('food')
    const [groceryCategory, setGroceryCategory] = useState(null)
    const [productIndex, setProductIndex] = useState(0)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [groceryResults, setGroceryResults] = useState([])
    const [stockedBasket, setStockedBasket] = useState(null)
    const [selectedGroceryCard, setSelectedGroceryCard] = useState(null)
    const [storedFocusKey, setFocusKey] = useState('start-shopping')
    const [
      selectedCategory,
      setSelectedCategory,
    ] = useState(null)
    const [dishIndex, setDishIndex] =
      useState(0)
    const [
      selectedDish,
      setSelectedDish,
    ] = useState(null)
    const [
      restaurants,
      setRestaurants,
    ] = useState([])
    const [
      selectedRestaurant,
      setSelectedRestaurant,
    ] = useState(null)
    const [menu, setMenu] =
      useState(null)
    const [
      selectedItem,
      setSelectedItem,
    ] = useState(null)
    const [
      selectedVariantIndex,
      setSelectedVariantIndex,
    ] = useState(0)
    const [quantity, setQuantity] =
      useState(1)
    const [cart, setCart] =
      useState(null)
    const [
      cartEnvelope,
      setCartEnvelope,
    ] = useState(null)
    const [
      checkoutQr,
      setCheckoutQr,
    ] = useState('')
    const [checkoutWithoutTracking, setCheckoutWithoutTracking] = useState(false)
    const [checkoutPayment, setCheckoutPayment] = useState('')
    const [brokenPaymentQr, setBrokenPaymentQr] = useState('')
    const [orderSubmitted, setOrderSubmitted] = useState(false)
    const [
      loadingPhase,
      setLoadingPhase,
    ] = useState('')
    const [
      flowError,
      setFlowError,
    ] = useState(null)
    const [notice, setNotice] =
      useState('')
    const [
      lastCheckoutAction,
      setLastCheckoutAction,
    ] = useState('')
    // Where a voice jump came from, so Back returns there once (navigation.js).
    const [jumpOrigin, setJumpOrigin] = useState(null)
    const [confirmStrip, setConfirmStrip] = useState(null)
    // Preserve the logical target, but the dialog owns the only visible focus.
    const focusKey = !open || confirmStrip ? null : storedFocusKey
    const [cartClearResult, setCartClearResult] = useState('')
    const [stripIndex, setStripIndex] = useState(0)
    /* 'pay' or 'cancel_order'. It drives one thing: the "Press OK to confirm"
       notice. It is NOT an authorisation and nothing reads it to submit - the
       charge is submitted only by activate()'s pre-existing
       `checkout-action-N` handler, which sends the action the user has
       focused. Cleared on navigation and on submission so it cannot linger. */
    const [awaitingConfirm, setAwaitingConfirm] = useState(null)
    const [lastRequest, setLastRequest] = useState(null)
    // Models survive Back within a journey; independent discovery clears them.
    const [widgetModel, setWidgetModelState] = useState(null)
    function setWidgetModel(value, target = screenRef.current) {
      const previous = widgetModelsRef.current[target] || widgetModel
      const model = typeof value === 'function' ? value(previous) : value
      if (model && NEW_SCREENS.includes(target)) widgetModelsRef.current[target] = model
      setWidgetModelState(model)
    }
    const [cartExpanded, setCartExpanded] = useState(false)
    /* Memoised because the panel reports these upward on every change: a
       fresh `[]` each render would re-fire that effect forever. */
    const dishes = useMemo(
      () => (selectedCategory ? QUICKBITE_DISHES[selectedCategory.id] || EMPTY_LIST : EMPTY_LIST),
      [selectedCategory],
    )
    const currentDish =
      dishes[dishIndex] ||
      selectedDish
    const products = useMemo(
      () => (groceryCategory ? GROCERY_PRODUCTS[groceryCategory.id] || EMPTY_LIST : EMPTY_LIST),
      [groceryCategory],
    )
    const currentProduct = products[productIndex] || selectedProduct
    const selectedVariant =
      selectedItem?.variants?.[
        Math.min(
          Math.max(0, selectedVariantIndex),
          Math.max(0, (selectedItem?.variants?.length || 1) - 1),
        )
      ] || null
    // A QR-only checkout cannot inherit a previous order's tracking state.
    const trackingSnapshot = checkoutWithoutTracking ? null : trackingState?.snapshot
    const livePhase =
      trackingPhase(
        trackingSnapshot,
      )
    const stableQr =
      [
        'preparing',
        'on-the-way',
        'delivered',
        'cancelled',
      ].includes(livePhase)
        ? ''
        : (checkoutWithoutTracking ? '' : trackingState?.qr) || checkoutQr ||
          (checkoutWithoutTracking ? '' : imageDataUri(activeOrder?.qr))
    const cartTotal =
      cart?.total
    const checkoutActions =
      useMemo(
        () =>
          orderSubmitted ? [] : checkoutActionLabels(
            cartEnvelope,
          ),
        [cartEnvelope, orderSubmitted],
      )
    const hasProviderCheckoutDecline = checkoutActions.some(label =>
      isCheckoutDeclineAction(label) || /^(?:cancel checkout|keep (?:my |the )?cart|no thanks)[.!]?$/i.test(label))
    const cartPaymentLabel =
      paymentDisplayLabel(
        checkoutPayment || cart?.payment,
      )
    const cartPlatformName = orderPlatform({
      cart,
      groceryCard: vertical === 'grocery' ? selectedGroceryCard : null,
      restaurant: vertical === 'food' ? selectedRestaurant : null,
    })
    const orderPlatformName = ORDER_SCREENS.has(screen) && !checkoutWithoutTracking
      ? orderPlatform({ tracking: { platform: trackingSnapshot?.platform || activeOrder?.tracking?.platform, server: trackingSnapshot?.server || activeOrder?.tracking?.server }, cart, groceryCard: vertical === 'grocery' ? selectedGroceryCard : null, restaurant: vertical === 'food' ? selectedRestaurant : null })
      : cartPlatformName
    const paymentMode = paymentPresentation({
      platform: orderPlatformName,
      payment: trackingSnapshot?.payment || trackingSnapshot?.payment_method || checkoutPayment || activeOrder?.tracking?.payment || activeOrder?.tracking?.payment_method || cart?.payment,
      qr: checkoutQr || (checkoutWithoutTracking ? '' : trackingState?.qr || activeOrder?.qr || trackingSnapshot?.payment_qr),
    })
    const missingZomatoInstructions = orderSubmitted && paymentMode === 'qr' &&
      providerId(orderPlatformName) === 'zomato' && !stableQr
    const waitingForInstructions = missingZomatoInstructions && trackingState?.polling && !trackingState?.completedPolls
    const screenKeys =
      useMemo(() => {
        if (['text', 'agent-cart', 'compare', 'basket-compare', 'spend'].includes(screen)) {
          /* While a widget button's request is in flight the screen shows only
             the loading state. Exposing the buttons would let a second OK
             re-send the same request (a basket filled twice) and let the
             arrows cycle keys nobody can see. */
          if (loadingPhase === 'agent') return []
          return focusKeysFor(screen, widgetModel, { expanded: cartExpanded })
        }
        if (screen === 'home') {
          return ['start-shopping']
        }
        if (screen === 'mode') {
          return ['mode-food', 'mode-grocery', ...QUICK_PROMPTS.map((_, index) => `quick-prompt-${index}`)]
        }
        if (screen === 'gcategory') {
          return GROCERY_CATEGORIES.map((_, index) => `gcategory-${index}`)
        }
        if (screen === 'gproduct') {
          return ['gproduct-card', 'select-gproduct']
        }
        if (screen === 'gresults') {
          if (loadingPhase === 'products') return []
          if (flowError) return ['retry']
          // Out-of-stock cards are excluded here on purpose: they render (dimmed)
          // but must not be focusable or selectable (task constraint), so they
          // never become a `gresult-N` focus key.
          return groceryResults
            .map((card, index) => (card.in_stock === false ? null : `gresult-${index}`))
            .filter(Boolean)
        }
        // A remote with no focusable key is a dead end: this is the one
        // key that leaves a stocked basket.
        if (screen === 'gbasket') {
          return [
            ...(stockedBasket?.lines || []).map((_, index) => `gbasket-item-${index}`),
            'gbasket-cart',
          ]
        }
        if (screen === 'greview') {
          if (loadingPhase === 'products') return []
          if (flowError?.kind === 'products') return ['retry']
          return [
            ...(quantity > 1 ? ['gqty-minus'] : []),
            'gqty-plus',
            'add-gcart',
            'shop-more',
          ]
        }
        if (screen === 'category') {
          return QUICKBITE_CATEGORIES.map(
            (_, index) =>
              `category-${index}`,
          )
        }
        if (screen === 'dish') {
          return [
            'dish-card',
            'select-dish',
          ]
        }
        if (
          screen === 'restaurant'
        ) {
          if (
            loadingPhase ===
            'restaurants'
          ) {
            return []
          }
          if (flowError) {
            return ['retry']
          }
          return restaurants.map(
            (_, index) =>
              `restaurant-${index}`,
          )
        }
        if (screen === 'menu') {
          if (
            loadingPhase === 'menu'
          ) {
            return []
          }
          if (flowError) {
            return ['retry']
          }
          return [
            ...(
              menu?.items || []
            ).map(
              (_, index) =>
                `menu-item-${index}`,
            ),
            'shop-more',
          ]
        }
        if (screen === 'review') {
          if (
            loadingPhase === 'menu'
          ) {
            return []
          }
          if (flowError) {
            return ['retry']
          }
          return [
            ...(
              selectedItem?.variants ||
              []
            ).map(
              (_, index) =>
                `variant-${index}`,
            ),
            ...(quantity > 1
              ? ['qty-minus']
              : []),
            'qty-plus',
            'add-cart',
            'shop-more',
          ]
        }
        if (screen === 'cart') {
          if (flowError) return ['retry', 'shop-more']
          const missingChoices = Boolean(cart?.items?.length && !orderSubmitted && !checkoutActions.length)
          const localDecline = Boolean(cart?.items?.length && !orderSubmitted && !hasProviderCheckoutDecline)
          return [
            ...(cart?.items || []).map((_, index) => `cart-item-${index}`),
            ...checkoutActions.map((_, index) => `checkout-action-${index}`),
            ...(missingChoices ? ['checkout-options'] : []),
            ...(localDecline ? ['cart-decline'] : []),
            ...(cart?.items?.length && !orderSubmitted ? ['cart-clear'] : []),
            'shop-more',
          ]
        }
        if (screen === 'pay') {
          return checkoutWithoutTracking ? ['shop-more'] : ['refresh-tracking', 'shop-more']
        }
        if (
          screen ===
          'payment-received'
        ) {
          return [
            'track-order',
            'shop-more',
          ]
        }
        if (
          screen === 'preparing' ||
          screen === 'on-the-way'
        ) {
          return [
            'refresh-tracking',
            'shop-more',
          ]
        }
        if (
          screen === 'delivered' ||
          screen === 'cancelled' || screen === 'cart-cleared'
        ) {
          return ['shop-more']
        }
        return []
      }, [
        screen,
        loadingPhase,
        flowError,
        restaurants,
        groceryResults,
        selectedItem,
        checkoutActions,
        hasProviderCheckoutDecline,
        cart,
        orderSubmitted,
        quantity,
        menu,
        widgetModel,
        stockedBasket,
        cartExpanded,
        checkoutWithoutTracking,
      ])
    // The heading is an explicit remote stop, so a user moving back up a
    // long response can read the answer above the first card.
    const contentKeys = useMemo(() => (
      screen === 'home' ||
        (NEW_SCREENS.includes(screen) && loadingPhase === 'agent')
        ? screenKeys : ['screen-heading', ...screenKeys]
    ), [screen, loadingPhase, screenKeys])
    useLayoutEffect(() => {
      if (!open || confirmStrip) return
      const valid = [...contentKeys, 'back', 'exit']
      if (!valid.includes(storedFocusKey)) setFocusKey(contentKeys[0] || 'back')
    }, [open, confirmStrip, contentKeys, storedFocusKey])
    useImperativeHandle(
      ref,
      () => ({
        handleKey: (key) =>
          handleKeyRef.current?.(
            key,
          ),
      }),
      [],
    )
    /* App needs the panel's state to build the view snapshot it sends with
       every utterance. The panel is the only place that knows it, so it
       reports upward rather than App guessing. */
    useEffect(() => {
      onPanelState?.({
        screen, vertical, focusKey, restaurants, groceryResults, cart,
        products, dishes, menuItems: menu?.items || [], selectedGroceryCard, widgetModel,
        // sourceFor reads these; omitting them left both category grids with
        // an empty snapshot, so "the second one" answered "Nothing to choose
        // from yet" with four tiles on screen.
        categories: QUICKBITE_CATEGORIES, groceryCategories: GROCERY_CATEGORIES,
      })
    }, [screen, vertical, focusKey, restaurants, groceryResults, cart,
        products, dishes, menu, selectedGroceryCard, widgetModel, onPanelState])
    useEffect(() => {
      const traceId = lastVoiceTraceRef.current
      if (!traceId) return
      voiceLog(traceId, 'QuickBite committed/rendered panel state', {
        screen, vertical, focusKey, open,
        restaurantCards: restaurants.length, groceryCards: groceryResults.length,
        menuItems: menu?.items?.length || 0, cartItems: cart?.items?.length || 0,
        widgetTitle: widgetModel?.title || null, loadingPhase,
        flowError, confirmation: confirmStrip?.question || null,
      })
      lastVoiceTraceRef.current = null
    }, [screen, vertical, focusKey, open, restaurants, groceryResults, menu, cart,
        widgetModel, loadingPhase, flowError, confirmStrip, lastRequest])
    /* The same snapshot the router is handed. Built on demand so a command
       always resolves references against what is on screen right now. */
    function currentView() {
      return buildView({
        screen, vertical, focusKey, restaurants, groceryResults, cart,
        products, dishes, menuItems: menu?.items || [], selectedGroceryCard, widgetModel,
        categories: QUICKBITE_CATEGORIES, groceryCategories: GROCERY_CATEGORIES,
        activeOrder,
      })
    }
    useLayoutEffect(() => {
      if (!open || confirmStrip) {
        return
      }
      const target =
        panelRef.current
          ?.querySelector(
            `[data-qb-focus="${focusKey}"]`,
          )
      target
        ?.focus?.({ preventScroll: true })
      // scrollIntoView also scrolls horizontal ancestors during the panel's
      // slide-in, which can clip Home and its focused CTA. Own only the body
      // scroll; header/footer targets must never move the surrounding player.
      const body = panelRef.current?.querySelector('.qb-panel-body')
      if (target && body?.contains(target)) {
        const bounds = body.getBoundingClientRect()
        const surface = target.closest('.qb-compare-card, .qb-bcmp-row, .qb-cart-line') || target
        const rect = surface.getBoundingClientRect()
        const delta = rect.top < bounds.top + 8 ? rect.top - bounds.top - 8
          : rect.bottom > bounds.bottom - 8 ? rect.bottom - bounds.bottom + 8 : 0
        if (focusKey === 'screen-heading') {
          body.scrollTo({ top: 0, behavior: 'instant' })
        } else if (delta) {
          body.scrollTo({ top: body.scrollTop + delta,
            behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
        }
      }
    }, [
      focusKey,
      open,
      screen,
      confirmStrip,
      dishIndex,
      productIndex,
    ])
    useEffect(() => {
      if (!open) {
        return undefined
      }
      if (
        screen === 'dish' &&
        focusKey ===
        'dish-card' &&
        !loadingPhase
      ) {
        const reduceMotion =
          window.matchMedia?.(
            '(prefers-reduced-motion: reduce)',
          ).matches
        if (
          reduceMotion ||
          dishes.length < 2
        ) {
          return undefined
        }
        const timer =
          window.setTimeout(
            () =>
              setDishIndex(
                (index) =>
                  (
                    index +
                    1
                  ) %
                  dishes.length,
              ),
            4000,
          )
        return () =>
          window.clearTimeout(
            timer,
          )
      }
      return undefined
    }, [
      open,
      screen,
      focusKey,
      dishIndex,
      dishes.length,
      loadingPhase,
    ])
    useEffect(() => {
      if (!open && shortcutSearchRef.current) {
        shortcutSearchRef.current = null
        setLoadingPhase('')
        setFlowError({ kind: 'products', message: 'The product search was closed. Retry to check availability.' })
        setFocusKey('retry')
      }
    }, [open])
    /* App navigation, intents and banner discovery use the existing router and
       handlers. A banner may search, but never adds or checks out by itself.
       Financial/destructive intents still arrive as `awaitConfirm`; the charge
       waits for a focused press on a checkout action. */
    useEffect(() => {
      if (!externalRequest?.nonce) return
      if (shortcutSearchRef.current && shortcutSearchRef.current.nonce !== externalRequest.nonce) {
        shortcutSearchRef.current = null
        setLoadingPhase('')
      }
      if (externalRequest.type === 'grocery-shortcut') {
        if (handledShortcutRef.current === externalRequest.nonce) return
        handledShortcutRef.current = externalRequest.nonce
        if (!groceryShortcutRequest(externalRequest.productId)) return
        const product = GROCERY_SHORTCUTS[externalRequest.productId]
        const guard = routeIntent({ name: 'search', confidence: 0.99, slots: {
          query: product.name, vertical: 'grocery',
        }, alternatives: [] }, currentView())
        if (guard.strip) { setConfirmStrip(guard.strip); setStripIndex(0); return }
        if (!merchantAccess?.grocery) { onRequestLogin?.('grocery'); return }
        setConfirmStrip(null)
        setNotice('')
        setGroceryCategory(null)
        selectProduct({ ...product, shortcut: product.id })
        return
      }
      const traceId = externalRequest.voiceTraceId
      if (traceId) {
        lastVoiceTraceRef.current = traceId
        voiceLog(traceId, 'QuickBite received external voice request', externalRequest)
      }
      if (externalRequest.type === 'voice-nav') {
        const target = externalRequest.target
        if (!target) {
          if (traceId) voiceWarn(traceId, 'Voice navigation target missing', externalRequest)
          lastVoiceTraceRef.current = null
          return
        }
        const guard = routeIntent(
          { name: 'go_home', confidence: 0.99, slots: {}, alternatives: [] },
          currentView(),
        )
        if (traceId) voiceLog(traceId, 'QuickBite voice navigation guard', { target, guard })
        if (guard.strip) {
          if (traceId) voiceWarn(traceId, 'QuickBite voice navigation stopped by confirmation strip', guard.strip)
          setConfirmStrip(guard.strip); setStripIndex(0); return
        }
        setConfirmStrip(null)
        setNotice('')
        if (target.type === 'home') { setScreenAndFocus('home', 'start-shopping'); return }
        if (target.type === 'food') {
          setVertical('food'); setScreenAndFocus('category', 'category-0'); return
        }
        if (target.type === 'grocery') {
          setVertical('grocery'); setScreenAndFocus('gcategory', 'gcategory-0'); return
        }
        if (target.type === 'food-category' || target.type === 'food-product') {
          const category = QUICKBITE_CATEGORIES.find((item) => item.id === (target.categoryId || target.id))
          if (!category) {
            if (traceId) voiceWarn(traceId, 'Food navigation category not found', target)
            lastVoiceTraceRef.current = null
            return
          }
          setVertical('food')
          setSelectedCategory(category)
          setDishIndex(target.type === 'food-product' ? target.index : 0)
          setSelectedDish(null)
          setScreenAndFocus('dish', 'dish-card')
          return
        }
        if (target.type === 'grocery-category' || target.type === 'grocery-product') {
          const category = GROCERY_CATEGORIES.find((item) => item.id === (target.categoryId || target.id))
          if (!category) {
            if (traceId) voiceWarn(traceId, 'Grocery navigation category not found', target)
            lastVoiceTraceRef.current = null
            return
          }
          setVertical('grocery')
          setGroceryCategory(category)
          setProductIndex(target.type === 'grocery-product' ? target.index : 0)
          setSelectedProduct(null)
          setScreenAndFocus('gproduct', 'gproduct-card')
        }
        if (!['home', 'food', 'grocery', 'food-category', 'food-product', 'grocery-category', 'grocery-product'].includes(target.type)) {
          if (traceId) voiceWarn(traceId, 'Voice navigation target type not handled by panel', target)
          lastVoiceTraceRef.current = null
        }
        return
      }
      if (externalRequest.type !== 'intent') return
      const { intent, envelope } = externalRequest
      setLastRequest(externalRequest)
      /* One router for every envelope (quickbite/widgetScreens.js). It
         replaced a chain whose last branch sent any unrecognised widget to
         the restaurant screen, so a grocery cart showed "Choose a Restaurant". */
      if (envelope) { showEnvelope(envelope, traceId); return }
      const decision = routeIntent(intent, currentView())
      if (traceId) voiceLog(traceId, 'QuickBite intent router decision', { intent, decision })
      if (decision.strip) {
        if (traceId) voiceWarn(traceId, 'QuickBite intent stopped by confirmation strip', decision.strip)
        setConfirmStrip(decision.strip); setStripIndex(0); return
      }
      setConfirmStrip(null)
      if (decision.patch?.notice) setNotice(decision.patch.notice)
      if (decision.patch?.vertical) setVertical(decision.patch.vertical)
      if (decision.awaitConfirm) {
        setAwaitingConfirm(decision.awaitConfirm)
        setNotice(decision.notice || 'Press OK to confirm.')
      }
      if (intent?.pending) {
        voicePendingRef.current = true
        if (traceId) voiceLog(traceId, 'QuickBite showing pending/loading screen', { intent: intent.name, vertical: intent.slots?.vertical || vertical })
        // A food search may return restaurants, a menu, a cart or a text
        // answer. Keep the query for a possible restaurant result, but do not
        // show a restaurant page before the envelope tells us its real kind.
        const query = String(intent?.slots?.query || '').trim()
        if (intent.journey === 'new-search') {
          resetSearchContext(intent.slots?.vertical || 'food')
          screenHistoryRef.current = []
        }
        if (query) {
          setSelectedCategory(null)
          /* `fromSearch` distinguishes this from a dish picked off the
             category grid. Both set selectedDish, but only the grid means
             "the user wants THIS dish" - a spoken query is just what they
             said, and selectRestaurant must still show the whole menu. */
          setSelectedDish({ name: query, emoji: '🍽️', fromSearch: true })
        }
        setRestaurants([])
        setFlowError(null)
        if (!decision.awaitConfirm) retireAwaitingConfirm()
        setWidgetModel(null)
        setLoadingPhase('agent'); setScreen('text', { replace: intent.journey === 'new-search' }); setFocusKey('back'); return
      }
      if (intent?.error) {
        if (traceId) voiceWarn(traceId, 'QuickBite showing backend/request error', { error: intent.error, screen })
        /* The neutral loading screen needs a visible error and a Retry action
           that resends the original request, regardless of its vertical. */
        setLoadingPhase('')
        setFlowError(null)
        setWidgetModel({ overline: 'QuickBite', title: intent.error, bullets: [], actions: [], retry: true,
          reconnectProvider: intent.reconnectProvider || null, error: true }, 'text')
        setScreen('text')
        setFocusKey(intent.reconnectProvider ? 'reconnect-provider' : 'retry')
        return
      }
      if (decision.action) {
        if (traceId) voiceLog(traceId, 'QuickBite executing local intent action', decision.action)
        executeCommand(decision.action); return
      }
      if (decision.screen === '__back__') { goBack(); return }
      if (decision.screen === '__discovery__') {
        if (traceId) voiceLog(traceId, 'QuickBite awaiting backend discovery response', { intent: intent?.name })
        return
      }
   // App is fetching
      if (!decision.screen) {
        if (traceId) voiceLog(traceId, 'QuickBite router did not request a screen change', { decision })
        return
      }
      const target = decision.screen === '__tracking__'
        ? screenForTracking(trackingSnapshot)
        : decision.screen
      if (traceId) voiceLog(traceId, 'QuickBite routing to screen', { target, focusKey: decision.focusKey })
      if (decision.jumpOrigin) setJumpOrigin({ ...decision.jumpOrigin, to: target })
      setFlowError(null)
      /* This path moves the screen with a bare setScreen, so it has to retire
         the prompt itself. Guarded on !decision.awaitConfirm so a decision that
         legitimately raises a new confirmation is not cleared by its own
         navigation. */
      if (!decision.awaitConfirm) retireAwaitingConfirm()
      setScreen(target)
      if (decision.focusKey) setFocusKey(decision.focusKey)
    }, [externalRequest?.nonce])
    useEffect(() => {
      if (!activeOrder?.seq) {
        return
      }
      suppressedTrackingPhaseRef.current = null
      setOrderSubmitted(true)
      setCheckoutWithoutTracking(false)
      setCheckoutPayment(activeOrder.payment || paymentMethodFromEnvelope({ tracking: activeOrder.tracking }))
      setBrokenPaymentQr('')
      setCheckoutQr(
        imageDataUri(
          activeOrder.qr,
        ),
      )
      if (screen === 'cart') {
        setScreen('pay')
        setFocusKey(
          'refresh-tracking',
        )
      }
    }, [
      activeOrder?.seq,
    ])
    useEffect(() => {
      if (
        !trackingSnapshot ||
        !ORDER_SCREENS.has(
          screen,
        )
      ) {
        return
      }
      if (suppressedTrackingPhaseRef.current) {
        if (livePhase === suppressedTrackingPhaseRef.current || livePhase === 'unknown') return
        suppressedTrackingPhaseRef.current = null
      }
      if (
        livePhase ===
        'cancelled'
      ) {
        setScreen('cancelled')
        setFocusKey(
          'shop-more',
        )
        return
      }
      if (
        screen === 'pay' &&
        [
          'preparing',
          'on-the-way',
          'delivered',
        ].includes(
          livePhase,
        )
      ) {
        setScreen(
          'payment-received',
        )
        setFocusKey(
          'track-order',
        )
        return
      }
      if (livePhase === 'pay' && screen !== 'pay') {
        setScreen('pay')
        setFocusKey('refresh-tracking')
        return
      }
      if (
        screen ===
        'preparing' &&
        livePhase ===
        'on-the-way'
      ) {
        setScreen(
          'on-the-way',
        )
      }
      if (
        (
          screen ===
          'preparing' ||
          screen ===
          'on-the-way'
        ) &&
        livePhase ===
        'delivered'
      ) {
        setScreen(
          'delivered',
        )
        setFocusKey('shop-more')
      }
    }, [
      trackingSnapshot,
      livePhase,
      screen,
    ])
    /* Retires a pending confirmation and the prompt that goes with it. The
       notice is separate state, so clearing only the flag would leave "Press OK
       to confirm payment" on a screen where it means nothing. Notices that are
       not confirmation prompts - "Quantity set to 2..." - are left alone. */
    function retireAwaitingConfirm() {
      setAwaitingConfirm(null)
      setNotice((current) => (/^Press OK to confirm/.test(current) ? '' : current))
    }
    function setScreenAndFocus(
      next,
      nextFocus,
      options,
    ) {
      /* Leaving the screen retires any pending confirmation. The intent effect
         and handleStripPick move the screen with setScreen directly, so raising
         a confirmation is never undone here. */
      if (next !== screenRef.current) {
        retireAwaitingConfirm()
        /* An error belongs to the screen that raised it. Letting it ride along
           put a "Retry" button on screens whose retry means something else
           entirely — including resubmitting a payment. */
        setFlowError(null)
      }
      setScreen(next, options)
      const defaultFocus = {
        home: 'start-shopping',
        mode: vertical === 'grocery' ? 'mode-grocery' : 'mode-food',
        gcategory: 'gcategory-0',
        gproduct: 'gproduct-card',
        gresults: groceryResults.some((card) => card.in_stock !== false)
          ? `gresult-${groceryResults.findIndex((card) => card.in_stock !== false)}`
          : 'retry',
        greview: 'add-gcart',
        gbasket: 'gbasket-cart',
        text: defaultFocusFor('text', widgetModelsRef.current.text),
        'agent-cart': defaultFocusFor('agent-cart', widgetModelsRef.current['agent-cart']),
        compare: defaultFocusFor('compare', widgetModelsRef.current.compare),
        'basket-compare': defaultFocusFor('basket-compare', widgetModelsRef.current['basket-compare']),
        spend: defaultFocusFor('spend', widgetModelsRef.current.spend),
        category:
          'category-0',
        dish:
          'dish-card',
        restaurant:
          restaurants.length
            ? 'restaurant-0'
            : 'retry',
        menu:
          menu?.items?.length
            ? 'menu-item-0'
            : 'shop-more',
        review:
          'add-cart',
        cart:
          checkoutActions.length
            ? 'checkout-action-0'
            : cart?.items?.length ? 'checkout-options' : 'shop-more',
        pay:
          checkoutWithoutTracking ? 'shop-more' : 'refresh-tracking',
        'payment-received':
          'track-order',
        preparing:
          'refresh-tracking',
        'on-the-way':
          'refresh-tracking',
        delivered:
          'shop-more',
        // contentKeys for `cancelled` is ['shop-more']; without this it fell
        // through to 'back', focusing something the ring does not contain.
        cancelled:
          'shop-more',
        'cart-cleared': 'shop-more',
      }
      setFocusKey(
        nextFocus ||
        defaultFocus[next] ||
        'back',
      )
    }
    function goBack() {
      // A question on screen is answered or dismissed before anything moves.
      if (confirmStrip) {
        setConfirmStrip(null)
        setStripIndex(0)
        return
      }
      if (screen === 'home') {
        onClose()
        return
      }
      journeyEpochRef.current += 1
      widgetActionRef.current = null
      cartEditInFlightRef.current = null
      shortcutSearchRef.current = null
      setFlowError(null)
      setLoadingPhase('')
      retireAwaitingConfirm()
      voicePendingRef.current = false
      const previous = takePreviousScreen(screenHistoryRef.current)
      screenHistoryRef.current = previous.history
      const nextScreen = previous.screen || backTarget(screen, vertical, jumpOrigin)
      if (ORDER_SCREENS.has(screen) && ORDER_SCREENS.has(nextScreen)) {
        suppressedTrackingPhaseRef.current = livePhase
      }
      if (jumpOrigin?.to === screen) setJumpOrigin(null)
      setScreenAndFocus(nextScreen, undefined, { replace: true })
    }
    /* Executes a router command through the panel's existing handlers. The
       router never calls these itself - it is pure - and it never issues a
       financial or destructive request at all; those set `awaitConfirm`, which
       only asks the user to press OK on a real checkout action. */
    async function executeCommand(action) {
      if (!action) return
      const view = currentView()
      const indexOf = (itemId) => view.items.findIndex((i) => i.id === itemId)
      /* On the menu screen `view.items` are DISHES, so an index must not be
         looked up in `restaurants` — that selected an unrelated restaurant and
         left the menu. Both reference commands resolve against the menu here. */
      function pickMenuItem(itemId) {
        const index = indexOf(itemId)
        const item = (menu?.items || [])[index]
        if (index < 0 || !item) return true
       // handled: nothing to select
        setSelectedItem(item)
        /* Reset as the remote path does. Without it "select the second one"
           inherited a quantity set on an earlier screen and the review screen
           opened at 4 for an utterance that named no quantity. */
        setQuantity(1)
        setScreenAndFocus(
          'review',
          item.variants?.length ? 'variant-0' : 'add-cart',
        )
        return true
      }
      if (action.name === 'select') {
        if (screen === 'menu') return pickMenuItem(action.args.itemId)
        const index = indexOf(action.args.itemId)
        if (index < 0) return
        if (vertical === 'grocery') {
          const card = groceryResults[index]
          if (card && card.in_stock !== false) {
            setSelectedGroceryCard(card)
            setScreenAndFocus('greview', 'add-gcart')
          }
          return
        }
        return selectRestaurant(restaurants[index])
      }
      if (action.name === 'addToCart') {
        const quantity = Math.max(1, Number(action.args.quantity) || 1)
        if (screen === 'menu') {
          // Open the dish for review with the quantity set; the add itself
          // still needs the press, as it does everywhere else in this flow.
          setQuantity(quantity)
          return pickMenuItem(action.args.itemId)
        }
        const index = indexOf(action.args.itemId)
        setQuantity(quantity)
        if (vertical === 'grocery') {
          const card = screen === 'greview' ? selectedGroceryCard : groceryResults[index]
          if (card) setSelectedGroceryCard(card)
          return addGroceryToCart(card, quantity)
        }
        // The food path needs a menu before an item can be added, so a card
        // that has not been opened yet is selected first; the review screen is
        // where the add happens.
        if (index >= 0 && restaurants[index] && restaurants[index] !== selectedRestaurant) {
          return selectRestaurant(restaurants[index])
        }
        return addToCart(quantity)
      }
      if (action.name === 'changeQty') {
        const quantity = Math.max(1, Number(action.args.quantity) || 1)
        setQuantity(quantity)
        setNotice(`Quantity set to ${quantity}. Press OK to update the cart.`)
        return setScreenAndFocus(vertical === 'grocery' ? 'greview' : 'review')
      }
      if (action.name === 'removeItem') {
        // Removal is a cart mutation the backend owns; surface the cart with
        // its own actions rather than inventing a removal call.
        setNotice('Choose the item to remove.')
        return setScreenAndFocus('cart', 'checkout-action-0')
      }
      if (action.name === 'confirmPending') {
        /* Voice may acknowledge, never authorise. A spoken "yes" only restates
           the prompt; the charge waits for a focused press on a checkout
           action, which is the only thing that submits one. */
        if (!awaitingConfirm) return undefined
        setNotice(awaitingConfirm === 'cancel_order'
          ? 'Press OK to confirm cancellation'
          : 'Press OK to confirm payment')
        return undefined
      }
      return undefined
    }
    /* A choice carries everything the original utterance had: the item it
       names, and whether it is a retry of the request that failed. */
    function handleStripPick(option) {
      if (!option) return
      setConfirmStrip(null)
      setStripIndex(0)
      if (option.intent === 'cart-destructive') {
        return submitCartDestruction(option.fromCheckout)
      }
      if (option.intent === 'stop') return
      if (option.retry && lastRequest) {
        onRetryRequest?.(lastRequest)
        return
      }
      const slots = option.itemId
        ? { item_ref: { type: 'explicit', resolved_id: option.itemId },
            quantity: lastRequest?.intent?.slots?.quantity ?? 1 }
        : (lastRequest?.intent?.slots || {})
      const view = currentView()
      const decision = routeIntent(
        { name: option.intent, confidence: 0.99, slots, alternatives: [],
          view_revision: view.view_revision },
        view,
      )
      if (decision.strip) { setConfirmStrip(decision.strip); return }
      if (decision.patch?.vertical) setVertical(decision.patch.vertical)
      if (decision.awaitConfirm) {
        setAwaitingConfirm(decision.awaitConfirm)
        setNotice(decision.notice || 'Press OK to confirm.')
      }
      if (decision.action) { executeCommand(decision.action); return }
      if (decision.screen === '__back__') { goBack(); return }
      if (!decision.screen || decision.screen === '__discovery__') return
      const target = decision.screen === '__tracking__'
        ? screenForTracking(trackingSnapshot) : decision.screen
      if (decision.jumpOrigin) setJumpOrigin({ ...decision.jumpOrigin, to: target })
      // Same bare-setScreen caveat as the intent effect above.
      if (!decision.awaitConfirm) retireAwaitingConfirm()
      setScreen(target)
      if (decision.focusKey) setFocusKey(decision.focusKey)
    }
    /* While the strip is up it owns the keyboard. Without this, Enter
       activates whatever the screen underneath had focused and Back
       navigates away from a question the user has not answered. */
    function handleStripKey(key) {
      if (!confirmStrip) return false
      const count = confirmStrip.options.length
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        setStripIndex((i) => Math.max(0, i - 1)); return true
      }
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        setStripIndex((i) => Math.min(count - 1, i + 1)); return true
      }
      if (key === 'Enter' || key === ' ') {
        handleStripPick(confirmStrip.options[stripIndex])
        return true
      }
      if (key === 'Escape' || key === 'Backspace') {
        setConfirmStrip(null); setStripIndex(0); return true
      }
      return true
   // swallow everything else
    }
    function shopMore() {
      const finishedOrder = ORDER_SCREENS.has(screen) || screen === 'cart-cleared'
      if (finishedOrder) {
        screenHistoryRef.current = []
        suppressedTrackingPhaseRef.current = null
      }
      setFlowError(null)
      setNotice('')
      setCheckoutQr('')
      setBrokenPaymentQr('')
      setCheckoutWithoutTracking(false)
      setCheckoutPayment('')
      setOrderSubmitted(false)
      setLastCheckoutAction('')
      // Browsing does not mutate or erase a valid cart. Back can return to it.
      return setScreenAndFocus('mode', vertical === 'grocery' ? 'mode-grocery' : 'mode-food', { replace: finishedOrder })
    }
    function resetSearchContext(nextVertical) {
      journeyEpochRef.current += 1
      widgetActionRef.current = null
      cartEditInFlightRef.current = null
      shortcutSearchRef.current = null
      widgetModelsRef.current = {}
      setVertical(nextVertical)
      setSelectedRestaurant(null)
      setMenu(null)
      setSelectedItem(null)
      setSelectedVariantIndex(0)
      setQuantity(1)
      setSelectedGroceryCard(null)
      setSelectedProduct(null)
      setGroceryResults([])
      setStockedBasket(null)
      setRestaurants([])
      setCart(null)
      setCartEnvelope(null)
      setWidgetModel(null)
      setCheckoutQr('')
      setCheckoutPayment('')
      setBrokenPaymentQr('')
      setCheckoutWithoutTracking(false)
    }
    async function selectDish(
      dish = currentDish,
    ) {
      if (!dish) {
        return
      }
      resetSearchContext('food')
      setSelectedDish(dish)
      setRestaurants([])
      setFlowError(null)
      setLoadingPhase(
        'restaurants',
      )
      setScreenAndFocus(
        'restaurant',
        'back',
      )
      let superseded = false
      try {
        const envelope =
          await sendSilent(
            `Find restaurants for ${dish.name} near me.`,
            { searchVertical: 'food' },
          )
        const cards =
          restaurantCardsFromEnvelope(
            envelope,
          )
        commerceLog('rendered', { screen: 'restaurant', providers: responseProviders(envelope) })
        setRestaurants(cards)
        setFlowError(
          cards.length
            ? null
            : {
                kind:
                  'restaurants',
                message:
                  envelope?.text ||
                  'No restaurants were returned.',
              },
        )
        setFocusKey(
          cards.length
            ? 'restaurant-0'
            : 'retry',
        )
      } catch (error) {
        if (error.kind === 'superseded-search') { superseded = true; return }
        setFlowError({
          kind:
            'restaurants',
          message:
            error.message,
        })
        setFocusKey(
          'retry',
        )
      } finally {
        if (!superseded) setLoadingPhase('')
      }
    }
    async function selectProduct(product = currentProduct) {
      if (!product) return
      const shortcut = product.shortcut && GROCERY_SHORTCUTS[product.shortcut]
      if (shortcut && shortcutSearchRef.current?.epoch === journeyEpochRef.current &&
        shortcutSearchRef.current.productId === shortcut.id) return
      resetSearchContext('grocery')
      const request = shortcut ? { productId: shortcut.id, epoch: journeyEpochRef.current,
        nonce: externalRequest?.nonce, lookupId: `${Date.now()}-${journeyEpochRef.current}` } : null
      if (request) shortcutSearchRef.current = request
      setSelectedProduct(product)
      setGroceryResults([])
      setSelectedGroceryCard(null)
      setFlowError(null)
      setLoadingPhase('products')
      setScreenAndFocus(shortcut ? 'greview' : 'gresults', 'back')
      let superseded = false
      try {
        let envelope = await sendSilent(shortcut ? groceryShortcutPrompt(shortcut, request.lookupId)
          : `Find ${product.name} near me.`, { searchVertical: 'grocery' })
        if (request && (shortcutSearchRef.current !== request ||
          journeyEpochRef.current !== request.epoch || !panelOpenRef.current)) {
          superseded = true; return
        }
        // Backend conversation history can replace a second lookup with a text
        // recap. Permit one bounded search-only recheck, never a cart mutation.
        if (shortcut && isRepeatedResultSummary(envelope)) {
          envelope = await sendSilent(
            groceryShortcutPrompt(shortcut, request.lookupId, true),
            { searchVertical: 'grocery' },
          )
          if (request && (shortcutSearchRef.current !== request ||
            journeyEpochRef.current !== request.epoch || !panelOpenRef.current)) {
            superseded = true; return
          }
        }
        if (shortcut && envelope?.widget === 'text' && envelope?.actions?.length) {
          showEnvelope(envelope)
          return
        }
        const cards = groceryCardsFromEnvelope(envelope)
        commerceLog('rendered', { screen: shortcut ? 'greview' : 'gresults', providers: responseProviders(envelope) })
        setGroceryResults(cards)
        if (shortcut) {
          const card = firstMatchingGroceryOffer(cards, shortcut.id)
          if (!card) {
            setFlowError({ kind: 'products',
              reason: cards.length ? 'unmatched-offers' : envelope?.widget === 'text' ? 'missing-offers' : 'unavailable',
              message: cards.length
                ? `No in-stock ${shortcut.name} with a confirmed price and store was returned. Retry to check availability.`
                : envelope?.widget === 'text'
                  ? 'The provider returned a text summary, not live priced product offers. Select Retry to request fresh results.'
                  : envelope?.text || `No in-stock ${shortcut.name} was returned. Retry to check availability.` })
            setFocusKey('retry')
          } else {
            setSelectedGroceryCard(card)
            setQuantity(1)
            setFocusKey('gqty-plus')
          }
          return
        }
        // Skip straight past any out-of-stock cards at the head of the list —
        // they are excluded from contentKeys, so landing focus on one would be
        // a dead ring the remote can never confirm.
        const firstFocusable = cards.findIndex((card) => card.in_stock !== false)
        // Same empty-result shape the restaurant path uses (cards.length ? null
        // : {kind, message}), extended for groceries: a list that came back
        // non-empty but with every card out of stock has no focusable element
        // either, so it must route through the same ErrorState/retry path
        // rather than rendering an all-dimmed list with nothing to land on.
        setFlowError(
          firstFocusable >= 0
            ? null
            : {
                kind: 'products',
                message: cards.length
                  ? `Everything matching ${product.name} is out of stock right now.`
                  : envelope?.text || 'No products were returned.',
              },
        )
        setFocusKey(firstFocusable >= 0 ? `gresult-${firstFocusable}` : 'retry')
      } catch (error) {
        if (request && (shortcutSearchRef.current !== request ||
          journeyEpochRef.current !== request.epoch || !panelOpenRef.current)) {
          superseded = true; return
        }
        if (error.kind === 'superseded-search') { superseded = true; return }
        setFlowError({ kind: 'products', message: error.message })
        setFocusKey('retry')
      } finally {
        if (!superseded) {
          if (shortcutSearchRef.current === request) shortcutSearchRef.current = null
          setLoadingPhase('')
        }
      }
    }
    async function selectRestaurant(
      restaurant,
    ) {
      if (!restaurant) {
        return
      }
      setSelectedRestaurant(
        restaurant,
      )
      setMenu(null)
      setSelectedItem(null)
      setSelectedVariantIndex(
        0,
      )
      setFlowError(null)
      setLoadingPhase(
        'menu',
      )
      /* Picking a restaurant off a list means "show me this place", so the
         whole menu is the destination. Only the category -> dish -> restaurant
         flow knows which dish the user is after, and only that flow should
         skip the menu and open one item for review. */
      const wantsWholeMenu =
        !selectedDish?.name ||
        selectedDish.fromSearch === true
      setScreenAndFocus(
        wantsWholeMenu
          ? 'menu'
          : 'review',
        'back',
      )

      const platform =
        restaurant.platform || ''
      if (!platform) {
        setLoadingPhase('')
        setFlowError({ kind: 'menu', message: 'The restaurant did not include a platform, so its menu cannot be requested safely.' })
        setFocusKey('retry')
        return
      }
      const prompt =
        (wantsWholeMenu
          // Without this branch the prompt asked for "the selected dishes",
          // with the word "selected" sent literally.
          ? `Show me the full menu at ${restaurant.name} on ${platform}. `
          : `Show me the ${selectedDish.name} dishes available at ${
            restaurant.name
          } on ${platform}. Only show matching items from this restaurant. `) +
        `Use the menu/show_menu capability. ` +
        `Do not add anything to cart. ` +
        `Do not place an order.`
      try {
        const envelope =
          await sendSilent(
            prompt,
          )
        const normalizedMenu =
          menuFromEnvelope(
            envelope,
          )
        const item =
          chooseMenuItem(
            normalizedMenu.items,
            selectedDish?.name,
          )
        if (!item) {
          throw new Error(
            envelope?.text ||
            'No matching menu items were returned.',
          )
        }
        setMenu(
          normalizedMenu,
        )
        if (wantsWholeMenu) {
          setFocusKey(
            'menu-item-0',
          )
          return
        }
        setSelectedItem(
          item,
        )
        setFocusKey(
          item.variants
            ?.length
            ? 'variant-0'
            : 'add-cart',
        )
      } catch (error) {
        setFlowError({
          kind: 'menu',
          message:
            error.message,
        })
        setFocusKey(
          'retry',
        )
      } finally {
        setLoadingPhase('')
      }
    }
    async function addToCart(count = quantity) {
      if (
        !selectedRestaurant ||
        !selectedItem
      ) {
        return
      }
      setCart(null)
      setCartEnvelope(null)
      setCheckoutQr('')
      setBrokenPaymentQr('')
      setCheckoutWithoutTracking(false)
      setCheckoutPayment('')
      setOrderSubmitted(false)
      setLastCheckoutAction(
        '',
      )
      setFlowError(null)
      /*
       * IMPORTANT:
       * immediately open the cart screen.
       */
      setLoadingPhase(
        'cart',
      )
      setScreen('cart')
      setFocusKey('back')
      const restaurant =
        selectedRestaurant.name
      const platform =
        selectedRestaurant
          .platform ||
        menu?.platform ||
        ''
      if (!platform) {
        setLoadingPhase('')
        setFlowError({ kind: 'cart', message: 'The selected item has no platform, so it cannot be added to a provider cart safely.' })
        setFocusKey('retry')
        return
      }
      const variantText =
        selectedVariant?.label
          ? ` (${selectedVariant.label})`
          : ''
      const prompt =
        `Order from ${restaurant} on ${platform}. ` +
        `Add EXACTLY these items to my cart: ` +
        `${count}× ${selectedItem.name}${variantText}. ` +
        `Do NOT ask me to re-pick items or variants. ` +
        `Show the cart total and ask me to confirm before checkout.`
      try {
        const envelope =
          await sendSilent(
            prompt,
          )
        const normalizedCart =
          cartFromEnvelope(
            envelope,
          )
        if (!normalizedCart) {
          throw new Error(
            envelope?.text ||
            'The backend did not return a cart.',
          )
        }
        setCartEnvelope(
          envelope,
        )
        setCart(
          normalizedCart,
        )
        const actions =
          checkoutActionLabels(
            envelope,
          )
        setFocusKey(
          actions.length
            ? 'checkout-action-0'
            : 'shop-more',
        )
      } catch (error) {
        setFlowError({
          kind: 'cart',
          message:
            error.message,
        })
        setFocusKey(
          'retry',
        )
      } finally {
        setLoadingPhase('')
      }
    }
    async function addGroceryToCart(card = selectedGroceryCard, count = quantity) {
      if (!card) {
        return
      }
      setCart(null)
      setCartEnvelope(null)
      setCheckoutQr('')
      setBrokenPaymentQr('')
      setCheckoutWithoutTracking(false)
      setCheckoutPayment('')
      setOrderSubmitted(false)
      setLastCheckoutAction('')
      setFlowError(null)
      /*
       * IMPORTANT:
       * immediately open the cart screen.
       */
      setLoadingPhase('cart')
      setScreen('cart')
      setFocusKey('back')
      const platform = card.platform || ''
      if (!platform) {
        setLoadingPhase('')
        setFlowError({ kind: 'cart', message: 'The selected product has no store, so it cannot be added to a provider cart safely.' })
        setFocusKey('retry')
        return
      }
      const pack = card.pack_size ? ` (${card.pack_size})` : ''
      const prompt =
        `Order from ${platform}. ` +
        `Add EXACTLY these items to my cart: ` +
        `${count}× ${card.name}${pack}. ` +
        `Do NOT ask me to re-pick items or variants. ` +
        `Show the cart total and ask me to confirm before checkout.`
      try {
        const envelope = await sendSilent(prompt)
        const normalizedCart = cartFromEnvelope(envelope)
        if (!normalizedCart) {
          throw new Error(
            envelope?.text || 'The backend did not return a cart.',
          )
        }
        setCartEnvelope(envelope)
        setCart(normalizedCart)
        const actions = checkoutActionLabels(envelope)
        setFocusKey(actions.length ? 'checkout-action-0' : 'checkout-options')
      } catch (error) {
        setFlowError({
          kind: 'cart',
          message: error.message,
        })
        setFocusKey('retry')
      } finally {
        setLoadingPhase('')
      }
    }
    /* Every agent envelope renders through here: the intent effect and every
       action button that asks the agent something. The registry decides the
       screen; this only applies the model to the state that screen reads. */
    function showEnvelope(envelope, voiceTraceId = null) {
      const replacePending = voicePendingRef.current && screenRef.current === 'text'
      voicePendingRef.current = false
      if (voiceTraceId) voiceLog(voiceTraceId, 'QuickBite received backend envelope for screen conversion', envelope)
      let parsed
      try {
        parsed = screenForEnvelope(envelope)
      } catch (error) {
        if (voiceTraceId) voiceError(voiceTraceId, 'QuickBite envelope-to-screen conversion failed', error)
        throw error
      }
      const { kind, screen: next, model } = parsed
      commerceLog('rendered', { screen: next, providers: responseProviders(envelope) })
      if (voiceTraceId) voiceLog(voiceTraceId, 'QuickBite envelope → card/screen model', { kind, screen: next, model })
      setLoadingPhase('')
      /* A strip or a confirmation raised by the previous utterance would
         otherwise survive onto the new results, where the strip still owns
         the keyboard and a focused press means something entirely different. */
      setConfirmStrip(null)
      setStripIndex(0)
      retireAwaitingConfirm()
      setFlowError(null)
      setCartExpanded(false)
      /* A menu envelope is not a restaurant list. Naming a restaurant by
         voice returns show_menu, whose payload.items are DISHES;
         restaurantCardsFromEnvelope falls through to payload.items and used
         to render them as restaurant cards under "Choose a Restaurant",
         imageless because it read image_url off the wrong shape. */
      if (next === 'menu') {
        setVertical('food')
        setMenu(model)
        /* The user asked for a restaurant, not a dish. Leaving the spoken
           query in selectedDish sent retry() down the single-item review
           branch instead of back to this menu. */
        setSelectedDish(null)
        if (model.restaurant) {
          setSelectedRestaurant({ name: model.restaurant, platform: model.platform, rating: model.rating, eta: model.eta })
        }
        setScreen('menu', { replace: replacePending }); setFocusKey('menu-item-0'); return
      }
      /* A stocked basket is a result, not a product list. It has its own
         screen because the grocery path's other screens each show one product,
         and this shows what happened to a whole list. `lines` is KEPT lines
         only, so a basket whose every suggestion was cut (empty `lines`, full
         `cut`) is still a real result; the registry only rejects one with
         neither. */
      if (next === 'gbasket') {
        setStockedBasket(model); setVertical('grocery')
        setScreen('gbasket', { replace: replacePending }); setFocusKey('gbasket-cart'); return
      }
      if (next === 'gresults') {
        setGroceryResults(model); setVertical('grocery')
        // Out-of-stock cards are excluded from contentKeys, so focus must skip
        // them or the ring lands on something the remote can never confirm —
        // the same rule the click path applies.
        const firstFocusable = model.findIndex((card) => card.in_stock !== false)
        if (firstFocusable < 0) {
          setFlowError({ kind: 'products', message: envelope?.text || 'No products were returned.' })
        }
        setScreen('gresults', { replace: replacePending }); setFocusKey(firstFocusable >= 0 ? `gresult-${firstFocusable}` : 'retry'); return
      }
      if (next === 'restaurant') {
        setVertical('food')
        setRestaurants(model)
        setScreen('restaurant', { replace: replacePending }); setFocusKey('restaurant-0'); return
      }
      // text, agent-cart, compare, basket-compare, spend
      /* A cart is grocery only when it is a grocery platform's: a Zomato or
         Swiggy food cart must keep the food path (Back, retry, vertical). */
      const groceryCart = (kind === 'cart' || kind === 'basket_stocked') && model?.editable
      if (groceryCart || kind === 'basket') setVertical('grocery')
      else if (kind === 'comparison') setVertical(model.vertical)
      else if (kind === 'cart' && ['zomato', 'swiggy_food'].includes(providerId(model?.platform))) setVertical('food')
      setWidgetModel(model, next)
      setScreen(next, { replace: replacePending })
      setFocusKey(defaultFocusFor(next, model))
    }
    /* Ask the agent something from a widget button, then show whatever comes
       back through the same router. Errors land on the text screen with
       Try again, never on a stale screen. */
    async function askFromWidget(prompt) {
      if (!prompt) return
      const epoch = journeyEpochRef.current
      if (widgetActionRef.current?.epoch === epoch) return
      const request = { epoch }
      widgetActionRef.current = request
      setLoadingPhase('agent')
      /* The pressed button disappears behind the loading state, so focus
         must leave it; contentKeys is empty until the answer arrives. */
      setFocusKey('back')
      try {
        const envelope = await sendSilent(prompt)
        if (epoch !== journeyEpochRef.current) return
        const tracking = trackingFromEnvelope(envelope)
        const confirmedCod = confirmedCodCheckout(envelope)
        /* Defence in depth. No widget button should reach an order (activate()
           routes order labels to the cart), but if the agent placed one anyway,
           the reply carries tracking or a payment QR. Show it the way
           submitCheckoutAction does - on `pay` - rather than leaving the user
           on a text screen while App's activeOrder effect, which moves only
           from `cart`, ignores it. */
        const qr = paymentQrFromEnvelope(envelope, { allowImageFallback: Boolean(tracking) && !confirmedCod })
        if (tracking || qr || confirmedCod) {
          const updatedCart = cartFromEnvelope(envelope)
          if (updatedCart) setCart(updatedCart)
          setCartEnvelope(envelope)
          setCheckoutPayment(paymentMethodFromEnvelope(envelope))
          if (qr) setCheckoutQr(qr)
          setCheckoutWithoutTracking(!tracking)
          setOrderSubmitted(true)
          if (!tracking) onClearActiveOrder?.()
          setLoadingPhase('')
          setScreenAndFocus('pay', tracking ? 'refresh-tracking' : 'shop-more')
          return
        }
        showEnvelope(envelope)
      } catch (error) {
        if (epoch !== journeyEpochRef.current || error.kind === 'superseded-search') return
        showEnvelope({ widget: 'hologram', text: error.message || 'Something went wrong.' })
      } finally {
        if (widgetActionRef.current === request) widgetActionRef.current = null
      }
    }
    function confirmCartDestruction(fromCheckout = false) {
      if (orderSubmitted || ORDER_SCREENS.has(screen)) {
        setNotice('An order is already in progress. Clearing a cart cannot cancel an order.')
        return
      }
      const platform = screen === 'cart' ? cartPlatformName
        : widgetModel?.platform || platformMentioned(widgetModel) || cartPlatformName || stockedBasket?.platform
      if (!cartClearRequestPrompt(platform, vertical)) {
        setNotice('Cannot identify the provider cart to clear. Open the provider cart first.')
        return
      }
      setConfirmStrip({ question: `Clear every item from ${platform} cart?`, options: [
        { label: 'Keep cart', intent: 'stop' },
        { label: 'Clear cart', intent: 'cart-destructive', fromCheckout },
      ] })
      setStripIndex(0)
    }
    function clearCartPresentation(envelope) {
      setCartClearResult(envelope?.text || envelope?.payload?.message || envelope?.payload?.title || 'Your cart is empty.')
      setCart(null)
      setCartEnvelope(null)
      setStockedBasket(null)
      setSelectedGroceryCard(null)
      setSelectedProduct(null)
      setSelectedItem(null)
      setSelectedVariantIndex(0)
      setSelectedRestaurant(null)
      setQuantity(1)
      delete widgetModelsRef.current['agent-cart']
      delete widgetModelsRef.current.text
      setWidgetModelState(null)
      setCartExpanded(false)
      setCheckoutQr('')
      setBrokenPaymentQr('')
      setCheckoutPayment('')
      setCheckoutWithoutTracking(false)
      setOrderSubmitted(false)
      setLastCheckoutAction('')
      setConfirmStrip(null)
      setStripIndex(0)
      setJumpOrigin(null)
      setNotice('')
      retireAwaitingConfirm()
      screenHistoryRef.current = []
      setScreenAndFocus('cart-cleared', 'shop-more', { replace: true })
      // Active-order evidence belongs to App and is deliberately preserved.
    }
    async function submitCartDestruction(fromCheckout = false) {
      const platform = screen === 'cart' ? cartPlatformName
        : widgetModel?.platform || platformMentioned(widgetModel) || cartPlatformName || stockedBasket?.platform
      const prompt = cartClearRequestPrompt(platform, vertical)
      const readback = cartReadbackPrompt(platform, vertical)
      if (!prompt || !readback) {
        setNotice('Cannot verify which provider owns this cart. Open that cart before clearing.')
        return
      }
      const epoch = journeyEpochRef.current
      if (checkoutInFlightRef.current || widgetActionRef.current?.epoch === epoch) return
      const request = { epoch }
      checkoutInFlightRef.current = true
      widgetActionRef.current = request
      setLoadingPhase(fromCheckout ? 'checkout' : 'agent')
      setFocusKey('back')
      setFlowError(null)
      const provider = providerId(platform, vertical)
      try {
        // Exactly one mutation. Never resend it as an automatic retry.
        const mutation = await sendSilent(prompt, { provider })
        if (epoch !== journeyEpochRef.current) return
        const tracking = trackingFromEnvelope(mutation)
        const confirmedCod = confirmedCodCheckout(mutation)
        const qr = paymentQrFromEnvelope(mutation, { allowImageFallback: Boolean(tracking) && !confirmedCod })
        if (tracking || qr || confirmedCod) {
          const updatedCart = cartFromEnvelope(mutation)
          if (updatedCart) setCart(updatedCart)
          setCartEnvelope(mutation)
          setCheckoutPayment(paymentMethodFromEnvelope(mutation))
          setCheckoutQr(qr)
          setCheckoutWithoutTracking(!tracking)
          setOrderSubmitted(true)
          if (!tracking) onClearActiveOrder?.()
          setScreenAndFocus('pay', tracking ? 'refresh-tracking' : 'shop-more')
          return
        }
        // A text "cleared" claim is never enough. Read the provider cart back.
        const verification = await sendSilent(readback, { provider })
        if (epoch !== journeyEpochRef.current) return
        if (verifiedEmptyCart(verification)) {
          clearCartPresentation({ text: `${platform} cart is empty (verified).` })
          return
        }
        const refreshed = cartFromEnvelope(verification)
        if (refreshed) {
          setCart(refreshed)
          if (screen === 'agent-cart') showEnvelope(verification)
        }
        setNotice(`Could not verify an empty ${platform} cart. Nothing was hidden; check the provider cart before retrying.`)
        setFocusKey(fromCheckout ? 'cart-clear' : 'acart-clear')
      } catch (error) {
        if (epoch !== journeyEpochRef.current || error.kind === 'superseded-search') return
        setNotice(`Couldn't confirm that ${platform} cart is empty: ${error.message || 'check the provider app.'}. The cart is retained.`)
        setFocusKey(fromCheckout ? 'cart-clear' : 'acart-clear')
      } finally {
        checkoutInFlightRef.current = false
        if (widgetActionRef.current === request) {
          widgetActionRef.current = null
          setLoadingPhase('')
        }
      }
    }
    async function reviewEditedCart() {
      const model = widgetModel
      const prompt = agentCartEditPrompt(model)
      if (!prompt) return openPlatformCart(model?.platform)
      const epoch = journeyEpochRef.current
      if (cartEditInFlightRef.current?.epoch === epoch) return
      const request = { epoch }
      cartEditInFlightRef.current = request
      setCart(null)
      setCartEnvelope(null)
      setOrderSubmitted(false)
      setCheckoutQr('')
      setCheckoutPayment('')
      setCheckoutWithoutTracking(false)
      setFlowError(null)
      setLoadingPhase('cart')
      setScreenAndFocus('cart', 'back')
      try {
        const envelope = await sendSilent(prompt, { provider: providerId(model.platform, 'grocery') })
        if (epoch !== journeyEpochRef.current) return
        if (trackingFromEnvelope(envelope) || paymentQrFromEnvelope(envelope, { allowImageFallback: false }) || confirmedCodCheckout(envelope)) {
          // Real order evidence is already retained by App; do not retry a mutation.
          setCartEnvelope(envelope)
          setOrderSubmitted(true)
          setCheckoutQr(paymentQrFromEnvelope(envelope, { allowImageFallback: false }))
          setCheckoutPayment(paymentMethodFromEnvelope(envelope))
          setCheckoutWithoutTracking(!trackingFromEnvelope(envelope))
          setScreenAndFocus('pay', 'refresh-tracking')
          return
        }
        const nextCart = cartFromEnvelope(envelope)
        if (!nextCart) throw new Error(envelope?.text || 'The provider did not return the updated cart.')
        setCart(nextCart)
        setCartEnvelope(envelope)
        // The actual response becomes the new baseline when Back reopens editing.
        const parsed = screenForEnvelope(envelope)
        if (parsed.screen === 'agent-cart') widgetModelsRef.current['agent-cart'] = parsed.model
        setFocusKey(checkoutActionLabels(envelope).length ? 'checkout-action-0' : 'shop-more')
      } catch (error) {
        if (epoch !== journeyEpochRef.current) return
        setFlowError({ kind: 'basket_cart', platform: model.platform,
          message: `${error.message} Refresh the current provider cart before editing again.` })
        setFocusKey('retry')
      } finally {
        if (cartEditInFlightRef.current === request) cartEditInFlightRef.current = null
        if (epoch === journeyEpochRef.current) setLoadingPhase('')
      }
    }
    /* stock_basket already wrote the platform cart, so "Go to cart" must READ
       it back — switching screens alone rendered an empty cart, because `cart`
       is only ever set from a backend cart envelope. */
    async function openPlatformCart(platform) {
      platform = platform || stockedBasket?.platform || ''
      if (!platform) {
        setNotice('The platform is missing. Please choose a store before opening its cart.')
        return
      }
      const epoch = journeyEpochRef.current
      /* `cart`'s fixed parent is greview/review, which a user arriving from
         gbasket, agent-cart or a text/spend button never saw. Record the
         real origin so Back returns there (navigation.js backTarget). Retry
         calls this from `cart` itself; keep the origin already recorded. */
      if (screen !== 'cart') setJumpOrigin({ from: screen, to: 'cart' })
      setCart(null)
      setCartEnvelope(null)
      setCheckoutQr('')
      setBrokenPaymentQr('')
      setCheckoutWithoutTracking(false)
      setCheckoutPayment('')
      setOrderSubmitted(false)
      setLastCheckoutAction('')
      setFlowError(null)
      setLoadingPhase('cart')
      setScreen('cart')
      setFocusKey('back')
      const prompt =
        `Show my current ${platform} cart exactly as it is now. ` +
        `Do NOT add, remove or change any items. ` +
        `Show the cart total and ask me to confirm before checkout.`
      try {
        const envelope = await sendSilent(prompt)
        if (epoch !== journeyEpochRef.current) return
        const tracking = trackingFromEnvelope(envelope)
        const confirmedCod = confirmedCodCheckout(envelope)
        const qr = paymentQrFromEnvelope(envelope, { allowImageFallback: Boolean(tracking) && !confirmedCod })
        if (tracking || qr || confirmedCod) {
          setCartEnvelope(envelope)
          setCheckoutPayment(paymentMethodFromEnvelope(envelope))
          if (qr) setCheckoutQr(qr)
          setCheckoutWithoutTracking(!tracking)
          setOrderSubmitted(true)
          if (!tracking) onClearActiveOrder?.()
          setScreenAndFocus('pay', tracking ? 'refresh-tracking' : 'shop-more')
          return
        }
        const normalizedCart = cartFromEnvelope(envelope)
        if (!normalizedCart) {
          throw new Error(envelope?.text || 'The backend did not return a cart.')
        }
        setCartEnvelope(envelope)
        setCart(normalizedCart)
        const actions = checkoutActionLabels(envelope)
        setFocusKey(actions.length ? 'checkout-action-0' : 'checkout-options')
      } catch (error) {
        if (epoch !== journeyEpochRef.current) return
        // The platform rides along so Try again reopens THIS cart.
        setFlowError({ kind: 'basket_cart', platform, message: error.message })
        setFocusKey('retry')
      } finally {
        if (epoch === journeyEpochRef.current) setLoadingPhase('')
      }
    }
    /* An order label on a text/spend screen: show the bill instead of
       ordering. The platform is the one the answer talks about, else the
       cart or basket already on hand. If none is known, ask for the cart
       without ordering; it lands on agent-cart, whose Checkout also goes
       through openPlatformCart. */
    function openCartForOrderLabel() {
      const platform = platformMentioned(widgetModel) || cart?.platform || stockedBasket?.platform
      if (platform) return openPlatformCart(platform)
      return askFromWidget('Show my cart exactly as it is. Do NOT place the order.')
    }
    /* Actionless cart fallback: ask for buttons, never submit checkout,
       cancellation, payment, or any other financial action. */
    async function requestCheckoutOptions() {
      if (!cart?.items?.length || orderSubmitted || loadingPhase || checkoutInFlightRef.current) return
      const platform = cartPlatformName
      const prompt = checkoutOptionsRequest(platform, vertical)
      if (!prompt) {
        setNotice('The provider for this cart is unknown. Keep your cart and return to the provider.')
        return
      }
      const epoch = journeyEpochRef.current
      checkoutInFlightRef.current = true
      setLoadingPhase('cart')
      setNotice('')
      try {
        const envelope = await sendSilent(prompt, { provider: providerId(platform, vertical) })
        if (epoch !== journeyEpochRef.current) return
        const refreshed = cartFromEnvelope(envelope)
        if (refreshed) setCart(refreshed)
        setCartEnvelope(envelope)
        const choices = checkoutActionLabels(envelope)
        if (choices.length) {
          setFocusKey('checkout-action-0')
        } else {
          setNotice('Checkout options are not available from this provider yet. Your cart has not been changed.')
          setFocusKey('checkout-options')
        }
      } catch (error) {
        if (epoch !== journeyEpochRef.current) return
        setNotice(`Unable to check checkout options: ${error.message || 'provider unavailable'}. Your cart is unchanged.`)
        setFocusKey('checkout-options')
      } finally {
        checkoutInFlightRef.current = false
        if (epoch === journeyEpochRef.current) setLoadingPhase('')
      }
    }
    async function submitCheckoutAction(
      label,
    ) {
      const action =
        String(
          label ?? '',
        ).trim()
      if (
        !cart ||
        !action ||
        orderSubmitted ||
        loadingPhase ===
        'checkout' ||
        checkoutInFlightRef.current
      ) {
        return
      }
      checkoutInFlightRef.current = true
      setLastCheckoutAction(
        action,
      )
      // The confirmation has been answered by a focused press; retire it.
      retireAwaitingConfirm()
      setFlowError(null)
      setLoadingPhase(
        'checkout',
      )
      try {
        const envelope =
          await sendSilent(
            action,
            { provider: providerId(cartPlatformName, vertical) },
          )
        const tracking = trackingFromEnvelope(envelope)
        const updatedCart =
          cartFromEnvelope(
            envelope,
          )
        if (updatedCart) {
          setCart(
            updatedCart,
          )
        }
        setCartEnvelope(
          envelope,
        )
        setCheckoutPayment(paymentMethodFromEnvelope(envelope))
        const confirmedCod = confirmedCodCheckout(envelope)
        const qr =
          paymentQrFromEnvelope(
            envelope,
            { allowImageFallback: !confirmedCod },
          )
        if (qr) {
          setCheckoutQr(
            qr,
          )
        }
        if (isCheckoutDeclineAction(action) && !tracking && !qr && !confirmedCod) {
          showEnvelope(envelope)
          return
        }
        if (
          tracking ||
          qr ||
          confirmedCod
        ) {
          const withoutTracking = !tracking
          setCheckoutWithoutTracking(withoutTracking)
          setOrderSubmitted(true)
          if (withoutTracking) onClearActiveOrder?.()
          setScreenAndFocus(
            'pay',
            withoutTracking ? 'shop-more' : 'refresh-tracking',
          )
          return
        }
        const nextActions =
          checkoutActionLabels(
            envelope,
          )
        if (
          nextActions.length
        ) {
          setScreen('cart')
          setFocusKey(
            'checkout-action-0',
          )
          return
        }
        throw new Error(
          envelope?.text ||
          'The provider did not confirm whether checkout completed or offer a next step.',
        )
      } catch (error) {
        setFlowError({
          kind:
            'checkout',
          message: `${error.message} Checkout may have succeeded. Review the provider's order status before submitting again.`,
        })
        setFocusKey(
          'retry',
        )
      } finally {
        checkoutInFlightRef.current = false
        setLoadingPhase('')
      }
    }
    async function retry() {
      const kind =
        flowError?.kind
      if (
        kind ===
        'restaurants'
      ) {
        await selectDish(
          selectedDish,
        )
        return
      }
      if (kind === 'products') {
        await selectProduct(selectedProduct)
        return
      }
      if (
        kind === 'menu'
      ) {
        await selectRestaurant(
          selectedRestaurant,
        )
        return
      }
      if (kind === 'cart') {
        await (vertical === 'grocery' ? addGroceryToCart() : addToCart())
        return
      }
      if (kind === 'basket_cart') {
        await openPlatformCart(flowError.platform)
        return
      }
      if (kind === 'checkout') {
        /* An uncertain checkout response must never replay the charge/action.
           Re-read the provider cart through the existing read-only prompt. */
        if (screen !== 'cart') {
          setNotice('Open the cart to review the provider status.')
          return
        }
        if (!cartPlatformName) {
          setNotice('The order platform is unknown. Check the provider app before trying checkout again.')
          return
        }
        setNotice('Checkout may already have succeeded. Verify in the provider app before placing another order.')
        await openPlatformCart(cartPlatformName)
      }
    }
    async function runQuickPrompt(index) {
      const scenario = quickPromptAt(index)
      if (!scenario || quickPromptInFlightRef.current) return
      if (!onQuickPrompt) {
        setNotice('Quick prompts are unavailable. Try again from the connected app.')
        return
      }
      quickPromptInFlightRef.current = true
      setNotice('')
      try {
        // App.handleTranscript does all the real voice routing after STT.
        // Calling it with typed-in script text skips only microphone/STT.
        await onQuickPrompt(scenario.prompt)
      } catch (error) {
        setNotice(error?.message || 'Unable to start the Quick Prompt.')
      } finally {
        quickPromptInFlightRef.current = false
      }
    }
    function activate(key) {
      if (key.startsWith('quick-prompt-')) return runQuickPrompt(trailingIndex(key))
      if (key === 'reconnect-provider' && widgetModel?.reconnectProvider) {
        const selected = PROVIDERS[widgetModel.reconnectProvider]
        return onRequestLogin?.(selected.vertical, widgetModel.reconnectProvider)
      }
      if (
        key === 'back'
      ) {
        return goBack()
      }
      if (
        key === 'exit'
      ) {
        return onClose()
      }
      if (key === 'start-shopping') {
        setNotice('')
        return setScreenAndFocus('mode', 'mode-food')
      }
      if (key === 'mode-food' || key === 'mode-grocery') {
        const grocery = key === 'mode-grocery'
        // Swiggy covers both food and Instamart, so either merchant for the
        // selected vertical is enough to unlock that journey.
        const blocked = !merchantAccess?.[grocery ? 'grocery' : 'food']
        if (blocked) {
          setNotice(
            grocery
              ? 'Connect Zepto or Swiggy to shop groceries.'
              : 'Connect Zomato or Swiggy to start ordering.',
          )
          onRequestLogin?.(grocery ? 'grocery' : 'food')
          return
        }
        setNotice('')
        setVertical(grocery ? 'grocery' : 'food')
        return grocery
          ? setScreenAndFocus('gcategory', 'gcategory-0')
          : setScreenAndFocus('category', 'category-0')
      }
      if (key.startsWith('gcategory-')) {
        const category = GROCERY_CATEGORIES[trailingIndex(key)]
        setGroceryCategory(category)
        setProductIndex(0)
        setSelectedProduct(null)
        return setScreenAndFocus('gproduct', 'gproduct-card')
      }
      if (key === 'gproduct-card' || key === 'select-gproduct') {
        return selectProduct()
      }
      if (key.startsWith('gresult-')) {
        const card = groceryResults[trailingIndex(key)]
        if (!card || card.in_stock === false) return undefined
        setSelectedGroceryCard(card)
        setQuantity(1)
        return setScreenAndFocus('greview', 'add-gcart')
      }
      if (key === 'gqty-minus') {
        if (quantity <= 1) {
          return undefined
        }
        return setQuantity((value) => Math.max(1, value - 1))
      }
      if (key === 'gqty-plus') {
        return setQuantity((value) => value + 1)
      }
      if (key === 'add-gcart') {
        return addGroceryToCart()
      }
      if (key === 'gbasket-cart') {
        return openPlatformCart(stockedBasket?.platform)
      }
      /* Agent widget buttons. text/spend action labels are the agent's own
         [[CHOICES]], and it offers "Yes, place the order": sending that label
         back would let the agent create the order with no bill on screen.
         So an order/pay label is never sent - it opens the platform cart,
         where the charge still needs a focused OK on `checkout-action-N`.
         Every other label is an ordinary question for the agent. */
      if (key.startsWith('text-action-') || key.startsWith('spend-action-')) {
        const label = widgetModel?.actions?.[trailingIndex(key)]
        if (isCartDestructiveAction(label)) return confirmCartDestruction(false)
        if (isOrderAction(label)) return openCartForOrderLabel()
        return askFromWidget(label)
      }
      if (key === 'acart-clear') return confirmCartDestruction(false)
      if (key === 'cart-clear') return confirmCartDestruction(true)
      if (key === 'checkout-options') return requestCheckoutOptions()
      if (key === 'cart-decline') return goBack()
      if (key === 'acart-checkout') {
        if (widgetModel?.editable) return reviewEditedCart()
        return openPlatformCart(widgetModel?.platform)
      }
      if (/^acart-(minus|plus)-\d+$/.test(key)) {
        const index = trailingIndex(key)
        const updated = editAgentCartQuantity(widgetModel, index, key.startsWith('acart-plus-') ? 1 : -1)
        if (updated === widgetModel) return
        setWidgetModel(updated)
        if (updated.lines.length < widgetModel.lines.length) {
          const next = Math.min(index, updated.lines.length - 1)
          setFocusKey(next >= 0 ? `acart-minus-${next}` : 'acart-checkout')
        }
        return
      }
      if (key === 'acart-edit') {
        return askFromWidget(`make changes to my ${widgetModel?.platform || ''} cart`.replace(/\s+/g, ' '))
      }
      if (key === 'acart-more') {
        setCartExpanded(true)
        return setFocusKey('acart-checkout')
      }
      if (key.startsWith('cmp-order-')) {
        const entry = widgetModel?.entries?.[trailingIndex(key)]
        if (entry) return askFromWidget(`order ${entry.name} from ${entry.platform}`)
        return undefined
      }
      if (key.startsWith('bcmp-fill-')) {
        const p = widgetModel?.platforms?.[trailingIndex(key)]
        if (p) return askFromWidget(`add the ${widgetModel.label} basket to my ${p.name} cart`)
        return undefined
      }
      if (
        key.startsWith(
          'category-',
        )
      ) {
        const category =
          QUICKBITE_CATEGORIES[
            trailingIndex(
              key,
            )
          ]
        setSelectedCategory(
          category,
        )
        setDishIndex(0)
        setSelectedDish(null)
        return setScreenAndFocus(
          'dish',
          'dish-card',
        )
      }
      if (
        key === 'dish-card' ||
        key ===
        'select-dish'
      ) {
        return selectDish()
      }
      if (
        key.startsWith(
          'restaurant-',
        )
      ) {
        return selectRestaurant(
          restaurants[
            trailingIndex(
              key,
            )
          ],
        )
      }
      if (
        key.startsWith(
          'variant-',
        )
      ) {
        return setSelectedVariantIndex(
          trailingIndex(
            key,
          ),
        )
      }
      if (
        key ===
        'qty-minus'
      ) {
        if (quantity <= 1) {
          return undefined
        }
        return setQuantity(
          (value) =>
            Math.max(
              1,
              value - 1,
            ),
        )
      }
      if (
        key ===
        'qty-plus'
      ) {
        return setQuantity(
          (value) =>
            value + 1,
        )
      }
      if (
        key ===
        'add-cart'
      ) {
        return addToCart()
      }
      if (
        key.startsWith(
          'menu-item-',
        )
      ) {
        /* The menu screen lists the restaurant's dishes; picking one opens
           the existing review screen, which owns variants and Add to cart. */
        const item =
          (menu?.items ||
            [])[
            trailingIndex(
              key,
            )
          ]
        if (!item) {
          return undefined
        }
        setSelectedItem(
          item,
        )
        setQuantity(1)
        return setScreenAndFocus(
          'review',
          item.variants
            ?.length
            ? 'variant-0'
            : 'add-cart',
        )
      }
      if (
        key.startsWith(
          'checkout-action-',
        )
      ) {
        const index =
          trailingIndex(
            key,
          )
        /* Focus is a string, not an element. A voice route can leave a
           `checkout-action-N` key focused on a screen that renders no such
           button, and `checkoutActions` is whatever the last envelope carried
           - after checkout that is the tracking envelope's free-text actions.
           Submitting then would send an unlabelled command the user never saw,
           so anything out of context fails closed. */
        if (
          screen !==
          'cart' ||
          flowError ||
          orderSubmitted ||
          !Number.isInteger(
            index,
          ) ||
          index < 0 ||
          index >=
          checkoutActions.length
        ) {
          // The press answered the prompt; leaving it pending would leave a
          // confirmation on screen that nothing here can ever satisfy.
          retireAwaitingConfirm()
          setNotice(
            'The provider did not offer that action.',
          )
          return
        }
        if (isCartDestructiveAction(checkoutActions[index])) return confirmCartDestruction(true)
        return submitCheckoutAction(
          checkoutActions[
            index
          ],
        )
      }
      /* The text screen's Try again resends the last request: retry()
         dispatches on flowError.kind, which is null there. */
      if (screen === 'text' && key === 'retry') {
        if (lastRequest) onRetryRequest?.(lastRequest)
        return undefined
      }
      if (
        key === 'retry'
      ) {
        return retry()
      }
      if (
        key ===
        'refresh-tracking'
      ) {
        if (checkoutWithoutTracking) {
          setNotice('The provider has not returned a tracking reference for this order.')
          return
        }
        return trackingState
          ?.refresh?.()
      }
      if (
        key ===
        'track-order'
      ) {
        suppressedTrackingPhaseRef.current = null
        return setScreenAndFocus(
          screenForTracking(
            trackingSnapshot,
          ),
          'refresh-tracking',
        )
      }
      if (
        key ===
        'shop-more'
      ) {
        return shopMore()
      }
      return undefined
    }
    function handleDirectionalKey(
      key,
    ) {
      if (screen === 'agent-cart' && widgetModel?.editable && !loadingPhase) {
        const next = editableCartFocusAfterArrow(focusKey, key, widgetModel.lines.length)
        if (next) { setFocusKey(next); return }
      }
      if (screen === 'mode') {
        const next = modeFocusAfterArrow(focusKey, key)
        if (next) { setFocusKey(next); return }
      }
      if (screen === 'gcategory' && focusKey.startsWith('gcategory-')) {
        const index = trailingIndex(focusKey)
        if (key === 'ArrowUp' && index < 2) { setFocusKey('screen-heading'); return }
        let next = index
        if (key === 'ArrowLeft' && index % 2 === 1) next -= 1
        if (key === 'ArrowRight' && index % 2 === 0) next += 1
        if (key === 'ArrowUp' && index >= 2) next -= 2
        if (key === 'ArrowDown' && index < 2) next += 2
        if (next !== index && GROCERY_CATEGORIES[next]) {
          setFocusKey(`gcategory-${next}`)
        } else if (key === 'ArrowDown') {
          setFocusKey('back')
        }
        return
      }
      if (
        screen === 'gproduct' &&
        focusKey === 'gproduct-card' &&
        (key === 'ArrowLeft' || key === 'ArrowRight')
      ) {
        const delta = key === 'ArrowRight' ? 1 : -1
        setProductIndex((index) => (index + delta + products.length) % products.length)
        return
      }
      if (
        screen === 'gresults' &&
        focusKey.startsWith('gresult-') &&
        (key === 'ArrowUp' || key === 'ArrowDown')
      ) {
        const index = trailingIndex(focusKey)
        const delta = key === 'ArrowDown' ? 1 : -1
        // Same clamped-arithmetic shape as the restaurant list block below, but
        // walking past any out-of-stock card in between: those are dimmed,
        // non-focusable rows, not stops on the remote's up/down path. `next`
        // only moves once an in-stock candidate is found; running off either
        // end keeps the current card or moves to Back.
        let next = index
        let cursor = index
        while (true) {
          cursor += delta
          if (cursor < 0 || cursor >= groceryResults.length) break
          if (groceryResults[cursor]?.in_stock !== false) {
            next = cursor
            break
          }
        }
        if (next === index && key === 'ArrowDown') setFocusKey('back')
        else if (next === index && key === 'ArrowUp') setFocusKey('screen-heading')
        else setFocusKey(`gresult-${next}`)
        return
      }
      /*
       * Quantity row navigation. Same shape as the food review screen's block
       * below, minus variants — there is nothing above the quantity row here.
       */
      if (screen === 'greview') {
        if (focusKey === 'gqty-minus') {
          if (key === 'ArrowUp') { setFocusKey('screen-heading'); return }
          if (key === 'ArrowRight') {
            setFocusKey('gqty-plus')
          } else if (key === 'ArrowDown') {
            setFocusKey('add-gcart')
          }
          return
        }
        if (focusKey === 'gqty-plus') {
          if (key === 'ArrowUp') { setFocusKey('screen-heading'); return }
          if (key === 'ArrowLeft' && quantity > 1) {
            setFocusKey('gqty-minus')
          } else if (key === 'ArrowDown') {
            setFocusKey('add-gcart')
          }
          return
        }
        if (focusKey === 'add-gcart') {
          if (key === 'ArrowUp') {
            setFocusKey('gqty-plus')
            return
          }
          if (key === 'ArrowDown') {
            setFocusKey('shop-more')
            return
          }
        }
        if (focusKey === 'shop-more' && key === 'ArrowUp') {
          setFocusKey('add-gcart')
          return
        }
      }
      if (
        screen ===
        'category' &&
        focusKey.startsWith(
          'category-',
        )
      ) {
        const index =
          trailingIndex(
            focusKey,
          )
        if (key === 'ArrowUp' && index < 2) { setFocusKey('screen-heading'); return }
        let next = index
        if (
          key ===
          'ArrowLeft' &&
          index % 2 === 1
        ) {
          next -= 1
        }
        if (
          key ===
          'ArrowRight' &&
          index % 2 === 0
        ) {
          next += 1
        }
        if (
          key ===
          'ArrowUp' &&
          index >= 2
        ) {
          next -= 2
        }
        if (
          key ===
          'ArrowDown' &&
          index < 2
        ) {
          next += 2
        }
        if (
          next !== index &&
          QUICKBITE_CATEGORIES[
            next
          ]
        ) {
          setFocusKey(
            `category-${next}`,
          )
        } else if (
          key ===
          'ArrowDown'
        ) {
          setFocusKey(
            'back',
          )
        }
        return
      }
      if (
        screen ===
        'dish' &&
        focusKey ===
        'dish-card' &&
        (
          key ===
          'ArrowLeft' ||
          key ===
          'ArrowRight'
        )
      ) {
        const delta =
          key ===
            'ArrowRight'
            ? 1
            : -1
        setDishIndex(
          (index) =>
            (
              index +
              delta +
              dishes.length
            ) %
            dishes.length,
        )
        return
      }
      if (
        screen ===
        'restaurant' &&
        focusKey.startsWith(
          'restaurant-',
        ) &&
        (
          key ===
          'ArrowUp' ||
          key ===
          'ArrowDown'
        )
      ) {
        const index =
          trailingIndex(
            focusKey,
          )
        const delta =
          key ===
            'ArrowDown'
            ? 1
            : -1
        const next =
          Math.max(
            0,
            Math.min(
              restaurants.length -
              1,
              index + delta,
            ),
          )
        if (next === index && key === 'ArrowDown') setFocusKey('back')
        else if (next === index && key === 'ArrowUp') setFocusKey('screen-heading')
        else setFocusKey(`restaurant-${next}`)
        return
      }
      /*
       * Quantity row navigation.
       */
      if (
        screen === 'review'
      ) {
        const hasVariants =
          Boolean(
            selectedItem?.variants
              ?.length,
          )
        const selectedVariantKey =
          hasVariants
            ? `variant-${Math.min(
                selectedVariantIndex,
                selectedItem.variants.length - 1,
              )}`
            : 'screen-heading'
        if (
          focusKey ===
          'qty-minus'
        ) {
          if (
            key ===
            'ArrowRight'
          ) {
            setFocusKey(
              'qty-plus',
            )
          } else if (
            key ===
            'ArrowDown'
          ) {
            setFocusKey(
              'add-cart',
            )
          } else if (
            key ===
            'ArrowUp'
          ) {
            setFocusKey(
              selectedVariantKey,
            )
          }
          return
        }
        if (
          focusKey ===
          'qty-plus'
        ) {
          if (
            key ===
            'ArrowLeft' &&
            quantity > 1
          ) {
            setFocusKey(
              'qty-minus',
            )
          } else if (
            key ===
            'ArrowDown'
          ) {
            setFocusKey(
              'add-cart',
            )
          } else if (
            key ===
            'ArrowUp'
          ) {
            setFocusKey(
              selectedVariantKey,
            )
          }
          return
        }
        if (
          focusKey ===
          'add-cart'
        ) {
          if (
            key ===
            'ArrowUp'
          ) {
            setFocusKey(
              'qty-plus',
            )
            return
          }
          if (
            key ===
            'ArrowDown'
          ) {
            setFocusKey(
              'shop-more',
            )
            return
          }
        }
        if (
          focusKey ===
          'shop-more' &&
          key ===
          'ArrowUp'
        ) {
          setFocusKey(
            'add-cart',
          )
          return
        }
        if (
          focusKey.startsWith(
            'variant-',
          ) &&
          key ===
          'ArrowDown'
        ) {
          setFocusKey(
            'qty-plus',
          )
          return
        }
      }
      const all = [
        ...contentKeys,
        'back',
        'exit',
      ]
      let index =
        all.indexOf(
          focusKey,
        )
      if (index < 0) {
        index = 0
      }
      if (
        key ===
        'ArrowDown'
      ) {
        setFocusKey(
          all[
            Math.min(
              all.length - 1,
              index + 1,
            )
          ],
        )
      }
      if (
        key ===
        'ArrowUp'
      ) {
        setFocusKey(
          all[
            Math.max(
              0,
              index - 1,
            )
          ],
        )
      }
      if (
        key ===
        'ArrowLeft' &&
        (
          focusKey ===
          'exit' ||
          focusKey ===
          'back'
        )
      ) {
        setFocusKey(
          'back',
        )
      }
      if (
        key ===
        'ArrowRight' &&
        (
          focusKey ===
          'exit' ||
          focusKey ===
          'back'
        )
      ) {
        setFocusKey(
          'exit',
        )
      }
    }

    handleKeyRef.current = (
      key,
    ) => {
      if (!open) {
        return false
      }
      /* Enter, Escape and Backspace never reach handleDirectionalKey - they
         are dispatched here - so the strip has to claim the keyboard at this
         level to own all four of them. */
      if (handleStripKey(key)) {
        return true
      }
      if (
        key === 'Escape' ||
        key === 'Backspace'
      ) {
        goBack()
      } else if (
        key === 'Enter' ||
        key === ' '
      ) {
        activate(
          focusKey,
        )
      } else if (
        key.startsWith(
          'Arrow',
        )
      ) {
        handleDirectionalKey(
          key,
        )
      } else {
        return false
      }
      return true
    }
    function focusableProps(
      key,
      onClick,
    ) {
      return {
        'data-qb-focus':
          key,
        onMouseMove:
          () =>
            setFocusKey(
              key,
            ),
        onFocus:
          () =>
            setFocusKey(
              key,
            ),
        onClick:
          onClick ||
          (() =>
            activate(
              key,
            )),
        tabIndex:
          open ? 0 : -1,
      }
    }
    function renderHeader(
      title,
      subtitle,
      breadcrumb,
    ) {
      return (
        <div className={`qb-screen-heading ${focusKey === 'screen-heading' ? 'is-focused' : ''}`}
          {...focusableProps('screen-heading')}>
          {breadcrumb && (
            <p className="qb-breadcrumb">
              {breadcrumb}
            </p>
          )}
          <h1>{title}</h1>
          {subtitle && (
            <p className="qb-subtitle">
              {subtitle}
            </p>
          )}
        </div>
      )
    }
    function renderHome() {
      return (
        <div
          className="qb-home"
          style={{
            '--qb-home-art': `url('${HOME_BACKDROP}')`,
          }}
        >
          {/* "Hungry?" predates the grocery vertical — the next screen offers
              both, so the greeting cannot assume food. */}
          <h1>
            What can we get
            you?
          </h1>
          <button
            className={`qb-primary-button qb-home-cta ${focusKey === 'start-shopping' ? 'is-focused' : ''}`}
            {...focusableProps('start-shopping')}
          >
            Start Shopping
          </button>
        </div>
      )
    }
    function renderMode() {
      const tiles = [
        { key: 'mode-food', art: MODE_TILES.food, title: 'Food', subtitle: 'Zomato · Swiggy', accent: '#E23744', unlocked: merchantAccess?.food },
        { key: 'mode-grocery', art: MODE_TILES.grocery, title: 'Grocery', subtitle: 'Zepto · Instamart', accent: '#7b3fe4', unlocked: merchantAccess?.grocery },
      ]
      return (
        <>
          {renderHeader('What are we getting?', 'Pick a shop to browse')}
          <div className="qb-mode-grid">
            {tiles.map((tile) => (
              <button
                key={tile.key}
                className={`qb-mode-card ${focusKey === tile.key ? 'is-focused' : ''} ${tile.unlocked ? '' : 'is-locked'}`}
                aria-label={`${tile.title}${tile.unlocked ? '' : ' locked. Select to connect a merchant by phone.'}`}
                style={{ '--qb-mode-accent': tile.accent, '--qb-mode-art': `url('${tile.art}')` }}
                {...focusableProps(tile.key)}
              >
                <span className="qb-focus-dot" />
                {!tile.unlocked && <span className="qb-mode-lock" aria-hidden="true">🔒 Connect by phone</span>}
                <span className="qb-mode-title">{tile.title}</span>
                <span className="qb-mode-subtitle">{tile.subtitle}</span>
              </button>
            ))}
          </div>
          <section className="qb-quick-prompts" aria-label="Quick prompts">
            <div className="qb-quick-prompts-header">
              <h2>Quick prompts</h2>
              <span>Try a scenario without speaking</span>
            </div>
            <div className="qb-quick-prompts-list">
              {QUICK_PROMPTS.map((scenario, index) => {
                const key = `quick-prompt-${index}`
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    className={`qb-quick-prompt ${focusKey === key ? 'is-focused' : ''}`}
                    {...focusableProps(key)}
                  >
                    <span className="qb-quick-prompt-tag">{scenario.category}</span>
                    <span className="qb-quick-prompt-copy">
                      <strong>{scenario.title}</strong>
                      <small>{scenario.description}</small>
                    </span>
                    <span className="qb-quick-prompt-arrow" aria-hidden="true">→</span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )
    }
    function renderGroceryCategory() {
      return (
        <>
          {renderHeader('Choose a Category', 'Delivered in minutes')}
          <div className="qb-category-grid">
            {GROCERY_CATEGORIES.map((category, index) => {
              const key = `gcategory-${index}`
              return (
                <button
                  key={category.id}
                  className={`qb-category-card ${focusKey === key ? 'is-focused' : ''}`}
                  {...focusableProps(key)}
                >
                  <span className="qb-focus-dot" />
                  <CategoryMedia category={category} />
                  <span className="qb-category-label">{category.name}</span>
                </button>
              )
            })}
          </div>
        </>
      )
    }
    function renderGroceryProduct() {
      return (
        <>
          {renderHeader('Choose a Product', 'Compared across Zepto & Instamart', groceryCategory?.name)}
          <div className="qb-dish-stage" aria-label="Product carousel">
            <div className="qb-dish-carousel">
              {products.map((product, index) => {
                let offset = index - productIndex
                if (offset > products.length / 2) offset -= products.length
                if (offset < -products.length / 2) offset += products.length
                const visible = Math.abs(offset) <= 1
                return (
                  <button
                    key={product.id}
                    data-qb-focus={index === productIndex ? 'gproduct-card' : undefined}
                    tabIndex={index === productIndex && open ? 0 : -1}
                    className={`qb-dish-card ${index === productIndex ? 'is-selected' : ''} ${
                      focusKey === 'gproduct-card' && index === productIndex ? 'is-focused' : ''
                    }`}
                    style={{
                      '--qb-dish-x': `${offset * 158}px`,
                      visibility: visible ? 'visible' : 'hidden',
                    }}
                    onMouseMove={() => {
                      setProductIndex(index)
                      setFocusKey('gproduct-card')
                    }}
                    onFocus={() => setFocusKey('gproduct-card')}
                    onClick={() =>
                      index === productIndex ? selectProduct(product) : setProductIndex(index)
                    }
                  >
                    <span className="qb-focus-dot" />
                    <DishMedia dish={product} />
                    <span className="qb-dish-name">{product.name}</span>
                    <span className="qb-discovery-label">Compare prices</span>
                  </button>
                )
              })}
            </div>
            <div className="qb-carousel-dots" aria-hidden="true">
              {products.map((product, index) => (
                <span key={product.id} className={index === productIndex ? 'is-active' : ''} />
              ))}
            </div>
            <button
              className={`qb-primary-button qb-select-dish ${focusKey === 'select-gproduct' ? 'is-focused' : ''}`}
              {...focusableProps('select-gproduct')}
            >
              Find {currentProduct?.name || 'this product'}
            </button>
          </div>
        </>
      )
    }
    function renderGroceryResults() {
      return (
        <>
          {renderHeader('Choose a Product', 'Cheapest first, across both stores', selectedProduct?.name)}
          {loadingPhase === 'products' && (
            <LoadingState label={`Comparing ${selectedProduct?.name || 'products'} across Zepto & Instamart`} />
          )}
          {flowError && (
            <ErrorState
              title="Couldn't load products"
              detail={structuredErrorDetail(flowError)}
              onRetry={retry}
              focused={focusKey === 'retry'}
              onFocus={() => setFocusKey('retry')}
            />
          )}
          {!loadingPhase && !flowError && (
            <div className="qb-restaurant-list">
              {groceryResults.map((card, index) => {
                const key = `gresult-${index}`
                const outOfStock = card.in_stock === false
                const off = card.mrp && card.price && card.mrp > card.price
                  ? Math.round((1 - card.price / card.mrp) * 100)
                  : 0
                return (
                  <button
                    key={`${card.platform}-${card.product_id || card.name}-${index}`}
                    className={`qb-restaurant-card qb-grocery-card ${focusKey === key ? 'is-focused' : ''} ${
                      outOfStock ? 'is-unavailable' : ''
                    }`}
                    disabled={outOfStock}
                    {...(outOfStock ? { 'data-qb-focus': key, tabIndex: -1 } : focusableProps(key))}
                  >
                    <span className="qb-focus-dot" />
                    <Media
                      src={card.image_url}
                      fallback="🛒"
                      alt={card.name}
                      className="qb-restaurant-image"
                    />
                    <span className="qb-restaurant-copy">
                      <PlatformBadge platform={card.platform} compact />
                      <strong className="qb-grocery-name">{card.name}</strong>
                      <span className="qb-meta-row">
                        <Meta>{card.brand}</Meta>
                        <Meta>{card.pack_size}</Meta>
                        {outOfStock && <span className="qb-oos">Out of stock</span>}
                      </span>
                      <span className="qb-grocery-price">
                        {card.price != null && <b>₹{card.price}</b>}
                        {off > 0 && <s>₹{card.mrp}</s>}
                        {off > 0 && <span className="qb-grocery-off">{off}% off</span>}
                        {card.unit_price_text && <span className="qb-grocery-unit">{card.unit_price_text}</span>}
                      </span>
                    </span>
                    {card.best && <span className="qb-grocery-ribbon">Best value</span>}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )
    }
    function widgetScreenProps() {
      return { model: widgetModel, focusKey, focusableProps, Media, renderHeader }
    }
    function renderWidgetLoading() {
      return loadingPhase === 'agent' ? <LoadingState label="Asking QuickBite…" /> : null
    }
    const renderText = () => renderWidgetLoading() || (widgetModel && <TextScreen {...widgetScreenProps()} />)
    const renderAgentCart = () => renderWidgetLoading() || (widgetModel && <AgentCartScreen {...widgetScreenProps()} expanded={cartExpanded} />)
    const renderCompare = () => renderWidgetLoading() || (widgetModel && <CompareScreen {...widgetScreenProps()} />)
    const renderBasketCompare = () => renderWidgetLoading() || (widgetModel && <BasketCompareScreen {...widgetScreenProps()} />)
    const renderSpend = () => renderWidgetLoading() || (widgetModel && <SpendScreen {...widgetScreenProps()} />)
    function renderGroceryBasket() {
      const b = stockedBasket
      if (!b) return null
      return (
        <div className="qb-screen qb-gbasket">
          <div className={`qb-screen-heading ${focusKey === 'screen-heading' ? 'is-focused' : ''}`}
            {...focusableProps('screen-heading')}>
            <h2 className="qb-title">{b.label}</h2>
            <p className="qb-sub">
              {b.stocked} of {b.lines.length + b.cut.length} added
              {b.platform ? ` · ${b.platform}` : ''}
            </p>
          </div>
          <ul className="qb-basket-cards">
            {b.lines.map((l, i) => {
              const missing = l.status === 'unavailable' || !l.name
              const off = l.mrp && l.price && l.mrp > l.price
                ? Math.round((1 - l.price / l.mrp) * 100)
                : 0
              return (
                <li key={`${l.query}-${i}`}
                    className={`qb-basket-card${missing ? ' missing' : ''}${focusKey === `gbasket-item-${i}` ? ' is-focused' : ''}`}
                    {...focusableProps(`gbasket-item-${i}`)}>
                  <Media
                    src={l.image_url}
                    fallback="🛒"
                    alt={l.name || l.query}
                    className="qb-basket-card-image"
                  />
                  {!missing && l.count > 0 && (
                    <span className="qb-basket-qty">× {l.count}</span>
                  )}
                  <span className="qb-basket-card-copy">
                    <PlatformBadge platform={l.platform || b.platform} compact />
                    <span className="qb-basket-ask">
                      {l.query}{l.requested ? ` · ${l.requested}` : ''}
                    </span>
                    <strong className="qb-basket-card-name">{l.name || 'Not found'}</strong>
                    {l.pack_size && <span className="qb-basket-pack">{l.pack_size}</span>}
                    <span className="qb-basket-card-price">
                      {l.price != null && <span>₹{l.price} each</span>}
                      {off > 0 && <s>₹{l.mrp}</s>}
                      {off > 0 && <span className="qb-grocery-off">{off}% off</span>}
                    </span>
                    <span className="qb-basket-card-total">
                      {l.line_total != null ? `₹${l.line_total}` : '—'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
          {b.budget == null ? (
            <div className="qb-basket-foot">Cart total <b>₹{b.total}</b></div>
          ) : (
            <div className="qb-basket-budget">
              <div className={'qb-basket-bar' + (b.fits ? '' : ' over')}>
                <span style={{ width: `${Math.min(100, Math.round((b.total / b.budget) * 100))}%` }} />
              </div>
              <div className="qb-basket-foot">
                <span>₹{b.total} of ₹{b.budget}</span>
                <b>{b.fits ? `₹${b.under_by} to spare` : `₹${b.over_by} over`}</b>
              </div>
            </div>
          )}
          {!b.fits && (
            <p className="qb-basket-note-over">
              This is the cheapest these items come to.
            </p>
          )}
          {b.cut.length > 0 && (
            <>
              <h3 className="qb-basket-cut-title">Left out to fit the budget</h3>
              <ul className="qb-basket-rows">
                {b.cut.map((l, i) => (
                  <li key={`cut-${l.query}-${i}`} className="qb-basket-row missing">
                    <span className="qb-basket-ask">
                      {l.query}{l.requested ? ` · ${l.requested}` : ''}
                    </span>
                    <span className="qb-basket-got">{l.name || 'not found'}</span>
                    <span className="qb-basket-amt">
                      {l.line_total != null ? `₹${l.line_total}` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            className={`qb-primary-button ${focusKey === 'gbasket-cart' ? 'is-focused' : ''}`}
            {...focusableProps('gbasket-cart')}>
            Go to cart
          </button>
        </div>
      )
    }
    function renderGroceryReview() {
      const card = selectedGroceryCard
      return (
        <>
          {renderHeader(selectedProduct?.shortcut ? 'Choose quantity' : 'Review', '', selectedProduct?.name)}
          {loadingPhase === 'products' && <LoadingState label={`Finding ${selectedProduct?.name || 'your product'}`} />}
          {flowError?.kind === 'products' && <ErrorState title={flowError.reason === 'missing-offers' ? 'Fresh product offers not returned' : "Couldn't find your product"}
            detail={structuredErrorDetail(flowError)} onRetry={retry} focused={focusKey === 'retry'}
            onFocus={() => setFocusKey('retry')} />}
          {!loadingPhase && !flowError && card && (
            <div className="qb-review">
              <div className="qb-review-card">
                <Media
                  src={card.image_url}
                  fallback="🛒"
                  alt={card.name}
                  className="qb-review-image"
                />
                <div>
                  <PlatformBadge platform={card.platform} compact />
                  <strong className="qb-grocery-name">{card.name}</strong>
                  <span className="qb-meta-row">
                    <Meta>{card.brand}</Meta>
                    <Meta>{card.pack_size}</Meta>
                  </span>
                  {card.price != null && (
                    <span className="qb-grocery-price">
                      <b>₹{card.price}</b>
                      {card.unit_price_text && (
                        <span className="qb-grocery-unit">{card.unit_price_text}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="qb-quantity-row">
                <span>Quantity</span>
                <div className="qb-quantity-controls">
                  <button
                    aria-label="Decrease quantity"
                    aria-disabled={quantity <= 1}
                    disabled={quantity <= 1}
                    className={`${quantity <= 1 ? 'is-disabled' : ''} ${
                      focusKey === 'gqty-minus' ? 'is-focused' : ''
                    }`}
                    {...focusableProps('gqty-minus')}
                  >
                    −
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    aria-label="Increase quantity"
                    className={focusKey === 'gqty-plus' ? 'is-focused' : ''}
                    {...focusableProps('gqty-plus')}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                className={`qb-primary-button ${focusKey === 'add-gcart' ? 'is-focused' : ''}`}
                {...focusableProps('add-gcart')}
              >
                Add to Cart
              </button>
              <button
                className={`qb-secondary-button ${focusKey === 'shop-more' ? 'is-focused' : ''}`}
                {...focusableProps('shop-more')}
              >
                Shop More
              </button>
            </div>
          )}
        </>
      )
    }
    function renderCategory() {
      return (
        <>
          {renderHeader(
            'Choose a Category',
            'What would you like today?',
          )}
          <div className="qb-category-grid">
            {QUICKBITE_CATEGORIES.map(
              (
                category,
                index,
              ) => {
                const key =
                  `category-${index}`
                return (
                  <button
                    key={
                      category.id
                    }
                    className={`qb-category-card ${
                      focusKey ===
                        key
                        ? 'is-focused'
                        : ''
                    }`}
                    {...focusableProps(
                      key,
                    )}
                  >
                    <span className="qb-focus-dot" />
                    <CategoryMedia
                      category={
                        category
                      }
                    />
                    <span className="qb-category-label">
                      {
                        category.name
                      }
                    </span>
                  </button>
                )
              },
            )}
          </div>
        </>
      )
    }
    function renderDish() {
      return (
        <>
          {renderHeader(
            'Choose a Dish',
            'Delivering near you',
            selectedCategory?.name,
          )}
          <div
            className="qb-dish-stage"
            aria-label="Dish carousel"
          >
            <div className="qb-dish-carousel">
              {dishes.map(
                (
                  dish,
                  index,
                ) => {
                  let offset =
                    index -
                    dishIndex
                  if (
                    offset >
                    dishes.length /
                    2
                  ) {
                    offset -=
                      dishes.length
                  }
                  if (
                    offset <
                    -dishes.length /
                    2
                  ) {
                    offset +=
                      dishes.length
                  }
                  const visible =
                    Math.abs(
                      offset,
                    ) <= 1
                  return (
                    <button
                      key={
                        dish.id
                      }
                      data-qb-focus={
                        index ===
                          dishIndex
                          ? 'dish-card'
                          : undefined
                      }
                      tabIndex={
                        index ===
                          dishIndex &&
                        open
                          ? 0
                          : -1
                      }
                      className={`qb-dish-card ${
                        index ===
                          dishIndex
                          ? 'is-selected'
                          : ''
                      } ${
                        focusKey ===
                          'dish-card' &&
                        index ===
                          dishIndex
                          ? 'is-focused'
                          : ''
                      }`}
                      style={{
                        '--qb-dish-x':
                          `${offset * 158}px`,
                        visibility:
                          visible
                            ? 'visible'
                            : 'hidden',
                      }}
                      onMouseMove={() => {
                        setDishIndex(
                          index,
                        )
                        setFocusKey(
                          'dish-card',
                        )
                      }}
                      onFocus={() =>
                        setFocusKey(
                          'dish-card',
                        )
                      }
                      onClick={() =>
                        index ===
                          dishIndex
                          ? selectDish(
                              dish,
                            )
                          : setDishIndex(
                              index,
                            )
                      }
                    >
                      <span className="qb-focus-dot" />
                      <DishMedia
                        dish={dish}
                      />
                      <span className="qb-dish-name">
                        {
                          dish.name
                        }
                      </span>
                      <span className="qb-discovery-label">
                        Discover nearby
                      </span>
                    </button>
                  )
                },
              )}
            </div>
            <div
              className="qb-carousel-dots"
              aria-hidden="true"
            >
              {dishes.map(
                (
                  dish,
                  index,
                ) => (
                  <span
                    key={
                      dish.id
                    }
                    className={
                      index ===
                        dishIndex
                        ? 'is-active'
                        : ''
                    }
                  />
                ),
              )}
            </div>
            <button
              className={`qb-primary-button qb-select-dish ${
                focusKey ===
                  'select-dish'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'select-dish',
              )}
            >
              Select{' '}
              {
                currentDish?.name
              }
            </button>
          </div>
        </>
      )
    }
    function renderRestaurant() {
      const crumb = [
        selectedCategory?.name,
        selectedDish?.name,
      ]
        .filter(Boolean)
        .join(' → ')
      return (
        <>
          {renderHeader(
            'Choose a Restaurant',
            `${
              selectedDish?.name ||
              'Food'
            } available nearby`,
            crumb,
          )}
          {loadingPhase ===
            'restaurants' && (
              <LoadingState
                label="Finding nearby restaurants"
              />
            )}
          {flowError && (
            <ErrorState
              title="Couldn't load restaurants"
              detail={
                structuredErrorDetail(
                  flowError,
                )
              }
              onRetry={retry}
              focused={
                focusKey ===
                'retry'
              }
              onFocus={() =>
                setFocusKey(
                  'retry',
                )
              }
            />
          )}
          {!loadingPhase &&
            !flowError && (
              <div className="qb-restaurant-list">
                {restaurants.map(
                  (
                    restaurant,
                    index,
                  ) => {
                    const key =
                      `restaurant-${index}`
                    return (
                      <button
                        key={
                          restaurant.rest_id ||
                          `${restaurant.name}-${index}`
                        }
                        className={`qb-restaurant-card ${
                          focusKey ===
                            key
                            ? 'is-focused'
                            : ''
                        }`}
                        {...focusableProps(
                          key,
                        )}
                      >
                        <span className="qb-focus-dot" />
                        <Media
                          src={
                            restaurant.image_url
                          }
                          fallback={
                            selectedDish?.emoji
                          }
                          alt={
                            restaurant.name
                          }
                          className="qb-restaurant-image"
                        />
                        <span className="qb-restaurant-copy">
                          <PlatformBadge platform={restaurant.platform} compact />
                          <strong>
                            {
                              restaurant.name
                            }
                          </strong>
                          {/* A dish card's `name` is the DISH; the place that
                              cooks it lives in `restaurant` and was being
                              dropped, leaving "Chicken Dum Biryani / Swiggy"
                              with no way to tell where it came from. */}
                          {restaurant.kind ===
                            'dish' &&
                            restaurant.restaurant && (
                              <small className="qb-dish-from">
                                {
                                  restaurant.restaurant
                                }
                              </small>
                            )}
                          {/* A restaurant answering "X and Y": the dish it
                              surfaced for each, then what it did not. */}
                          {restaurant.kind ===
                            'restaurant_match' &&
                            matchedDishLines(restaurant).map((line) => (
                              <small key={line} className="qb-match-dish">
                                {line}
                              </small>
                            ))}
                          {restaurant.kind ===
                            'restaurant_match' &&
                            notFoundLabel(restaurant) && (
                              <em className="qb-match-missing">
                                {notFoundLabel(restaurant)}
                              </em>
                            )}
                          {restaurant.cuisine && (
                            <small>
                              {
                                restaurant.cuisine
                              }
                            </small>
                          )}
                          <span className="qb-meta-row">
                            <Meta>
                              {
                                restaurant.rating !=
                                null
                                  ? `★ ${restaurant.rating}`
                                  : ''
                              }
                            </Meta>
                            <Meta>
                              {
                                restaurant.eta
                              }
                            </Meta>
                            <Meta>
                              {money(
                                restaurant.price ??
                                restaurant.from_price ??
                                restaurant.price_for_two,
                              )}
                            </Meta>
                          </span>
                          {/* A near-miss is a real, orderable option that
                              fails something the user asked for. Saying which
                              is what separates "shown" from "recommended". */}
                          {missLabel(
                            restaurant,
                          ) && (
                            <em className="qb-dish-miss">
                              {missLabel(
                                restaurant,
                              )}
                            </em>
                          )}
                          {restaurant.offer && (
                            <em>
                              {
                                restaurant.offer
                              }
                            </em>
                          )}
                        </span>
                        {restaurant.best && (
                          <span className="qb-dish-ribbon">
                            Best match
                          </span>
                        )}
                      </button>
                    )
                  },
                )}
              </div>
            )}
        </>
      )
    }
    /* A fetched restaurant menu. Distinct from `review`, which shows a single
       item: naming a restaurant by voice returns the whole menu, and it used
       to fall through to the restaurant-card list and render dishes under
       "Choose a Restaurant" with no images. */
    function renderMenu() {
      const items = menu?.items || []
      return (
        <>
          {renderHeader(
            menu?.restaurant ||
            'Menu',
            `${items.length} item${items.length === 1 ? '' : 's'} to order`,
            [
              menu?.platform,
              menu?.rating
                ? `★ ${menu.rating}`
                : '',
              menu?.eta,
            ]
              .filter(Boolean)
              .join(' → '),
          )}
          {loadingPhase ===
            'menu' && (
              <LoadingState
                label="Loading the menu"
              />
            )}
          {flowError && (
            <ErrorState
              title="Couldn't load the menu"
              detail={
                structuredErrorDetail(
                  flowError,
                )
              }
              onRetry={retry}
              focused={focusKey === 'retry'}
              onFocus={() => setFocusKey('retry')}
            />
          )}
          {!flowError &&
            loadingPhase !==
            'menu' && (
              <div className="qb-restaurant-list">
                {items.map(
                  (
                    item,
                    index,
                  ) => {
                    const key = `menu-item-${index}`
                    const price =
                      item.offer_price ??
                      item.price ??
                      item.variants?.[0]
                        ?.price
                    return (
                      <button
                        key={key}
                        className={`qb-restaurant-card ${
                          focusKey ===
                            key
                            ? 'is-focused'
                            : ''
                        }`}
                        {...focusableProps(
                          key,
                        )}
                      >
                        <span className="qb-focus-dot" />
                        <Media
                          src={
                            item.image_url
                          }
                          fallback="🍽️"
                          alt={
                            item.name
                          }
                          className="qb-restaurant-image"
                        />
                        <span className="qb-restaurant-copy">
                          <PlatformBadge platform={item.platform || menu?.platform} compact />
                          {item.category && (
                            <span className="qb-menu-category">
                              {
                                item.category
                              }
                            </span>
                          )}
                          <strong>
                            {
                              item.name
                            }
                          </strong>
                          <span className="qb-meta-row">
                            <Meta>
                              {money(
                                price,
                              )}
                            </Meta>
                            <Meta>
                              {item.variants
                                ?.length
                                ? `${item.variants.length} sizes`
                                : ''}
                            </Meta>
                          </span>
                        </span>
                      </button>
                    )
                  },
                )}
              </div>
            )}
        </>
      )
    }

    function renderReview() {
      const crumb = [
        selectedCategory?.name,
        selectedDish?.name,
        selectedRestaurant?.name,
      ]
        .filter(Boolean)
        .join(' → ')
      const price =
        selectedVariant?.price ??
        selectedItem?.offer_price ??
        selectedItem?.price
      return (
        <>
          {renderHeader(
            'Review',
            '',
            crumb,
          )}
          {loadingPhase ===
            'menu' && (
              <LoadingState
                label="Loading the live menu"
              />
            )}
          {flowError && (
            <ErrorState
              title="Couldn't load this menu"
              detail={
                structuredErrorDetail(
                  flowError,
                )
              }
              onRetry={retry}
              focused={
                focusKey ===
                'retry'
              }
              onFocus={() =>
                setFocusKey(
                  'retry',
                )
              }
            />
          )}
          {!loadingPhase &&
            !flowError &&
            selectedItem && (
              <div className="qb-review">
                <div className="qb-review-card">
                  <Media
                    src={
                      selectedItem.image_url
                    }
                    fallback={
                      selectedDish?.emoji
                    }
                    alt={
                      selectedItem.name
                    }
                    className="qb-review-image"
                  />
                  <div>
                    <PlatformBadge platform={selectedRestaurant?.platform || menu?.platform} compact />
                    <p className="qb-overline">
                      {
                        selectedRestaurant?.name
                      }
                    </p>
                    <h2>
                      {
                        selectedItem.name
                      }
                    </h2>
                    <div className="qb-meta-row">
                      <Meta>
                        {
                          selectedRestaurant?.rating !=
                          null
                            ? `★ ${selectedRestaurant.rating}`
                            : ''
                        }
                      </Meta>
                      <Meta>
                        {
                          selectedRestaurant?.eta ||
                          menu?.eta
                        }
                      </Meta>
                    </div>
                    {price != null && (
                      <p className="qb-price">
                        {money(
                          price,
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {selectedItem.variants
                  ?.length > 0 && (
                    <div className="qb-variants">
                      <h3>
                        Choose a variant
                      </h3>
                      {selectedItem.variants.map(
                        (
                          variant,
                          index,
                        ) => {
                          const key =
                            `variant-${index}`
                          return (
                            <button
                              key={`${variant.label}-${index}`}
                              aria-pressed={selectedVariantIndex === index}
                              className={`qb-variant-button ${
                                selectedVariantIndex ===
                                  index
                                  ? 'is-selected'
                                  : ''
                              } ${
                                focusKey ===
                                  key
                                  ? 'is-focused'
                                  : ''
                              }`}
                              {...focusableProps(
                                key,
                              )}
                            >
                              <span>
                                {
                                  variant.label
                                }
                              </span>
                              <strong>
                                {money(
                                  variant.price,
                                )}
                              </strong>
                            </button>
                          )
                        },
                      )}
                    </div>
                  )}
                <div className="qb-quantity-row">
                  <span>
                    Quantity
                  </span>
                  <div className="qb-quantity-controls">
                    <button
                      aria-label="Decrease quantity"
                      aria-disabled={
                        quantity <= 1
                      }
                      disabled={
                        quantity <= 1
                      }
                      className={`${
                        quantity <= 1
                          ? 'is-disabled'
                          : ''
                      } ${
                        focusKey ===
                          'qty-minus'
                          ? 'is-focused'
                          : ''
                      }`}
                      {...focusableProps(
                        'qty-minus',
                      )}
                    >
                      −
                    </button>
                    <strong>
                      {quantity}
                    </strong>
                    <button
                      aria-label="Increase quantity"
                      className={
                        focusKey ===
                          'qty-plus'
                          ? 'is-focused'
                          : ''
                      }
                      {...focusableProps(
                        'qty-plus',
                      )}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className={`qb-primary-button ${
                    focusKey ===
                      'add-cart'
                      ? 'is-focused'
                      : ''
                  }`}
                  {...focusableProps(
                    'add-cart',
                  )}
                >
                  Add to Cart
                </button>
                <button
                  className={`qb-secondary-button ${
                    focusKey ===
                      'shop-more'
                      ? 'is-focused'
                      : ''
                  }`}
                  {...focusableProps(
                    'shop-more',
                  )}
                >
                  Shop More
                </button>
              </div>
            )}
        </>
      )
    }
    function renderCart() {
      const subtotal =
        safeSubtotal(
          cart,
        )
      const errorTitle =
        flowError?.kind ===
          'checkout'
          ? "Couldn't continue checkout"
          : "Couldn't prepare your cart"
      return (
        <>
          <ProgressStepper
            stage="review"
          />
          {renderHeader(
            'My Cart',
          )}
          {loadingPhase ===
            'cart' && (
              <LoadingState
                label="Preparing your cart"
              />
            )}
          {flowError && (
            <ErrorState
              title={
                errorTitle
              }
              detail={
                structuredErrorDetail(
                  flowError,
                )
              }
              onRetry={
                retry
              }
              retryLabel={flowError?.kind === 'checkout' ? 'Review cart' : 'Retry'}
              focused={
                focusKey ===
                'retry'
              }
              onFocus={() =>
                setFocusKey(
                  'retry',
                )
              }
            />
          )}
          {/*
           * REMOVE THIS BLOCK + IMPORT
           * IF YOU WANT REAL-ONLY CODE.
           */}
          {cart && (
            <div className="qb-cart">
              {cart.items.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    className={`qb-cart-item ${focusKey === `cart-item-${index}` ? 'is-focused' : ''}`}
                    key={`${item.name}-${index}`}
                    {...focusableProps(`cart-item-${index}`)}
                  >
                    <Media
                      src={
                        item.image_url
                      }
                      fallback={
                        selectedDish?.emoji
                      }
                      alt={
                        item.name
                      }
                      className="qb-cart-image"
                    />
                    <div>
                      <PlatformBadge platform={item.platform || cartPlatformName} compact />
                      <h3>
                        {
                          item.name
                        }
                      </h3>
                      <p>
                        {
                          cart.restaurant ||
                          selectedRestaurant?.name
                        }
                      </p>
                      <span>
                        Qty{' '}
                        {
                          item.quantity
                        }
                      </span>
                    </div>
                    <strong>
                      {money(
                        item.total ??
                        item.line_total ??
                        item.offer_price ??
                        item.price,
                      )}
                    </strong>
                  </div>
                ),
              )}
              {(
                cart.address ||
                cart.eta ||
                cartPaymentLabel
              ) && (
                <div className="qb-delivery-card">
                  {cart.address && (
                    <div>
                      <span>
                        Deliver to
                      </span>
                      <strong>
                        {
                          typeof cart.address ===
                            'object'
                            ? cart.address.label ||
                              cart.address.address
                            : cart.address
                        }
                      </strong>
                    </div>
                  )}
                  {cart.eta && (
                    <div>
                      <span>
                        Delivery in
                      </span>
                      <strong>
                        {
                          cart.eta
                        }
                      </strong>
                    </div>
                  )}
                  {cartPaymentLabel && (
                    <div>
                      <span>
                        Payment
                      </span>
                      <strong>
                        {
                          cartPaymentLabel
                        }
                      </strong>
                    </div>
                  )}
                </div>
              )}
              <div className="qb-bill">
                {subtotal !=
                  null && (
                    <div>
                      <span>
                        Subtotal
                      </span>
                      <strong>
                        {money(
                          subtotal,
                        )}
                      </strong>
                    </div>
                  )}
                {cart.delivery !=
                  null && (
                    <div>
                      <span>
                        Delivery
                      </span>
                      <strong>
                        {money(
                          cart.delivery,
                        )}
                      </strong>
                    </div>
                  )}
                {cart.taxes !=
                  null && (
                    <div>
                      <span>
                        Taxes &amp;
                        Charges
                      </span>
                      <strong>
                        {money(
                          cart.taxes,
                        )}
                      </strong>
                    </div>
                  )}
                {cart.other_charges !=
                  null && (
                    <div>
                      <span>
                        Other
                        Charges
                      </span>
                      <strong>
                        {money(
                          cart.other_charges,
                        )}
                      </strong>
                    </div>
                  )}
                {cart.discount !=
                  null && (
                    <div className="qb-bill-off">
                      <span>
                        Discount
                      </span>
                      <strong>
                        {'\u2212'}
                        {money(
                          cart.discount,
                        )}
                      </strong>
                    </div>
                  )}
                {cart.total !=
                  null && (
                    <div className="qb-bill-total">
                      <span>
                        Total
                      </span>
                      <strong>
                        {money(
                          cart.total,
                        )}
                      </strong>
                    </div>
                  )}
              </div>
              {!flowError &&
                cartEnvelope?.text && (
                  <p className="qb-inline-notice">
                    {
                      cartEnvelope.text
                    }
                  </p>
                )}
              {!flowError &&
                checkoutActions.map(
                  (
                    action,
                    index,
                  ) => {
                    const key =
                      `checkout-action-${index}`
                    const busy =
                      loadingPhase ===
                      'checkout' &&
                      lastCheckoutAction ===
                      action
                    return (
                      <button
                        key={`${action}-${index}`}
                        className={`${
                          index === 0
                            ? 'qb-primary-button'
                            : 'qb-secondary-button'
                        } ${
                          focusKey ===
                            key
                            ? 'is-focused'
                            : ''
                        }`}
                        {...focusableProps(
                          key,
                        )}
                        disabled={
                          loadingPhase ===
                          'checkout'
                        }
                      >
                        {busy
                          ? 'Working…'
                          : action}
                      </button>
                    )
                  },
                )}
              {!flowError &&
                !orderSubmitted &&
                Boolean(cart.items.length) &&
                checkoutActions.length === 0 && (
                  <button
                    type="button"
                    className={`qb-primary-button ${focusKey === 'checkout-options' ? 'is-focused' : ''}`}
                    {...focusableProps('checkout-options')}
                    disabled={Boolean(loadingPhase)}
                  >
                    {loadingPhase === 'cart' ? 'Checking checkout options…' : 'Check checkout options'}
                  </button>
                )}
              {!flowError &&
                !orderSubmitted &&
                Boolean(cart.items.length) &&
                !hasProviderCheckoutDecline && (
                  <button
                    type="button"
                    className={`qb-secondary-button ${focusKey === 'cart-decline' ? 'is-focused' : ''}`}
                    {...focusableProps('cart-decline')}
                    disabled={Boolean(loadingPhase)}
                  >
                    Cancel checkout · Keep cart
                  </button>
                )}
              {!flowError && orderSubmitted && !checkoutActions.length && (
                <p className="qb-inline-notice">
                  Checkout was already submitted. Check the provider status before placing another order.
                </p>
              )}
              {!flowError && !orderSubmitted && Boolean(cart.items.length) && <button
                type="button"
                className={`qb-secondary-button ${focusKey === 'cart-clear' ? 'is-focused' : ''}`}
                {...focusableProps('cart-clear')}
                disabled={Boolean(loadingPhase)}
              >Clear Cart</button>}
              <button
                className={`qb-secondary-button ${
                  focusKey ===
                    'shop-more'
                    ? 'is-focused'
                    : ''
                }`}
                {...focusableProps(
                  'shop-more',
                )}
                disabled={
                  loadingPhase ===
                  'checkout'
                }
              >
                Shop More
              </button>
            </div>
          )}
        </>
      )
    }
    function renderPay() {
      return (
        <>
          <ProgressStepper
            stage="pay"
          />
          {renderHeader(
            missingZomatoInstructions && !waitingForInstructions
              ? 'Payment instructions unavailable'
              : paymentMode === 'qr'
              ? 'Pay on your Phone'
              : paymentMode === 'cod'
                ? 'Order Confirmed'
                : 'Order Status',
          )}
          <div className="qb-pay">
            <PlatformBadge platform={orderPlatformName} />
            {cartPaymentLabel && (
              <p className="qb-inline-notice">
                Payment:{' '}
                {
                  cartPaymentLabel
                }
              </p>
            )}
            {paymentMode === 'cod' ? (
              <div className="qb-cod-confirm">
                <div className="qb-success-check">
                  ✓
                </div>
                <p className="qb-cod-title">
                  Cash on delivery
                </p>
                <p>
                  Pay the delivery
                  partner when your
                  order arrives.
                </p>
              </div>
            ) : stableQr && stableQr !== brokenPaymentQr ? (
              <>
                <img
                  className="qb-payment-qr"
                  src={
                    stableQr
                  }
                  alt="Payment QR code"
                  onError={() => setBrokenPaymentQr(stableQr)}
                />
                <p>
                  Scan with any UPI
                  app
                </p>
              </>
            ) : missingZomatoInstructions ? (
              <div className="qb-qr-wait" role={waitingForInstructions ? 'status' : 'alert'}>
                {waitingForInstructions && <span className="qb-spinner" />}
                <p>{waitingForInstructions
                  ? 'Checking for Zomato payment instructions…'
                  : 'Zomato has not returned payment instructions yet. Check payment status or open this order in Zomato. Do not place the order again.'}</p>
                {(trackingSnapshot?.order_id || activeOrder?.tracking?.order_id) &&
                  <p>Order: {trackingSnapshot?.order_id || activeOrder?.tracking?.order_id}</p>}
              </div>
            ) : paymentMode === 'qr' ? (
              <div className="qb-qr-wait">
                <span className="qb-spinner" />
                <p>
                  {stableQr && stableQr === brokenPaymentQr
                    ? 'The provider’s payment QR could not be displayed. Check its app or refresh payment status.'
                    : 'Waiting for payment instructions from the provider…'}
                </p>
              </div>
            ) : (
              <div className="qb-qr-wait">
                <span className="qb-spinner" />
                <p>Checking order and payment details with the provider…</p>
              </div>
            )}
            {cartTotal !=
              null && (
                <p className="qb-payment-amount">
                  {money(
                    cartTotal,
                  )}
                </p>
              )}
            <small>
              {paymentMode === 'qr'
                ? 'Payment confirmation comes from the provider.'
                : paymentMode === 'cod'
                  ? 'Pay the delivery partner when the order arrives.'
                  : 'Payment method will be shown when confirmed by the provider.'}
            </small>
            {!checkoutWithoutTracking && trackingState?.stale && (
              <p className="qb-stale-warning">
                {
                  trackingState.error
                }
              </p>
            )}
            {checkoutWithoutTracking && (
              <p className="qb-stale-warning">The provider did not return a tracking reference. Check its app for this order's live status.</p>
            )}
            {!checkoutWithoutTracking && <button
              className={`qb-secondary-button ${
                focusKey ===
                  'refresh-tracking'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'refresh-tracking',
              )}
            >
              {trackingState?.polling
                ? 'Checking…'
                : 'Check payment status'}
            </button>}
            <button
              className={`qb-text-button ${
                focusKey ===
                  'shop-more'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'shop-more',
              )}
            >
              Shop More
            </button>
          </div>
        </>
      )
    }
    function renderPaymentReceived() {
      return (
        <>
          <ProgressStepper
            stage="track"
          />
          <div className="qb-confirmation">
            <div className="qb-success-check">
              ✓
            </div>
            <h1>
              {paymentMode === 'qr' ? 'Payment received' : 'Order confirmed'}
            </h1>
            <PlatformBadge platform={orderPlatformName} />
            {cartTotal !=
              null && (
                <p className="qb-payment-amount">
                  {money(
                    cartTotal,
                  )}
                </p>
              )}
            <h2>
              {paymentMode === 'qr' ? 'Your order is confirmed' : 'Track your delivery below'}
            </h2>
            {trackingText(
              trackingSnapshot,
            ) && (
              <p className="qb-precise-status">
                {trackingText(
                  trackingSnapshot,
                )}
              </p>
            )}
            <button
              className={`qb-primary-button ${
                focusKey ===
                  'track-order'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'track-order',
              )}
            >
              Track Order
            </button>
            <button
              className={`qb-secondary-button ${
                focusKey ===
                  'shop-more'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'shop-more',
              )}
            >
              Shop More
            </button>
          </div>
        </>
      )
    }
    function renderTrackingScreen(
      phase,
    ) {
      const isDelivered =
        phase ===
        'delivered'
      const title =
        isDelivered
          ? 'Delivered'
          : phase ===
            'on-the-way'
            ? 'On the Way'
            : 'Preparing your order'
      return (
        <>
          <TrackingStepper
            phase={phase}
          />
          <div
            className={`qb-tracking-content ${
              isDelivered
                ? 'is-delivered'
                : ''
            }`}
          >
            <div
              className="qb-track-hero-icon"
              aria-hidden="true"
            >
              {isDelivered
                ? '🎉'
                : phase ===
                  'on-the-way'
                  ? '🛵'
                  : '👨‍🍳'}
            </div>
            <h1>{title}</h1>
            {isDelivered && (
              <>
                <h2>
                  At your doorstep
                </h2>
                <p className="qb-enjoy">
                  Enjoy food!
                </p>
              </>
            )}
            {!isDelivered &&
              trackingSnapshot?.eta && (
                <p className="qb-track-eta">
                  Arriving in{' '}
                  {
                    trackingSnapshot.eta
                  }
                </p>
              )}
            <div className="qb-order-status-card">
              <PlatformBadge platform={orderPlatformName} />
              {(
                trackingSnapshot?.restaurant_name ||
                selectedRestaurant?.name ||
                cart?.restaurant
              ) && (
                <h3>
                  {
                    trackingSnapshot?.restaurant_name ||
                    selectedRestaurant?.name ||
                    cart?.restaurant
                  }
                </h3>
              )}
              {trackingText(
                trackingSnapshot,
              ) && (
                <p>
                  {trackingText(
                    trackingSnapshot,
                  )}
                </p>
              )}
              {trackingSnapshot?.message &&
                trackingSnapshot.message !==
                trackingText(
                  trackingSnapshot,
                ) && (
                  <small>
                    {
                      trackingSnapshot.message
                    }
                  </small>
                )}
              {trackingSnapshot?.order_id && (
                <span>
                  Order{' '}
                  {
                    trackingSnapshot.order_id
                  }
                </span>
              )}
              {trackingSnapshot?.rider
                ?.name && (
                  <div className="qb-rider-row">
                    <span>
                      🛵
                    </span>
                    <strong>
                      {
                        trackingSnapshot
                          .rider.name
                      }
                    </strong>
                    {trackingSnapshot
                      .rider.rating !=
                      null && (
                        <em>
                          ★{' '}
                          {
                            trackingSnapshot
                              .rider.rating
                          }
                        </em>
                      )}
                  </div>
                )}
            </div>
            {trackingState?.stale && (
              <p className="qb-stale-warning">
                {
                  trackingState.error
                }
              </p>
            )}
            {!isDelivered && (
              <button
                className={`qb-secondary-button ${
                  focusKey ===
                    'refresh-tracking'
                    ? 'is-focused'
                    : ''
                }`}
                {...focusableProps(
                  'refresh-tracking',
                )}
              >
                {trackingState?.polling
                  ? 'Refreshing…'
                  : 'Refresh'}
              </button>
            )}
            <button
              className={`qb-text-button ${
                focusKey ===
                  'shop-more'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'shop-more',
              )}
            >
              Shop More
            </button>
          </div>
        </>
      )
    }
    function renderCancelled() {
      return (
        <>
          <div className="qb-confirmation qb-cancelled">
            <div className="qb-state-icon">
              ×
            </div>
            <h1>
              Order cancelled
            </h1>
            <PlatformBadge platform={orderPlatformName} />
            <p>
              {
                trackingSnapshot?.message ||
                trackingText(
                  trackingSnapshot,
                ) ||
                'The provider has cancelled this order.'
              }
            </p>
            <button
              className={`qb-primary-button ${
                focusKey ===
                  'shop-more'
                  ? 'is-focused'
                  : ''
              }`}
              {...focusableProps(
                'shop-more',
              )}
            >
              Shop More
            </button>
          </div>
        </>
      )
    }
    const renderers = {
      home:
        renderHome,
      mode: renderMode,
      gcategory: renderGroceryCategory,
      gproduct: renderGroceryProduct,
      gresults: renderGroceryResults,
      greview: renderGroceryReview,
      gbasket: renderGroceryBasket,
      text: renderText,
      'agent-cart': renderAgentCart,
      compare: renderCompare,
      'basket-compare': renderBasketCompare,
      spend: renderSpend,
      category:
        renderCategory,
      dish:
        renderDish,
      restaurant:
        renderRestaurant,
      menu:
        renderMenu,
      review:
        renderReview,
      cart:
        renderCart,
      pay:
        renderPay,
      'payment-received':
        renderPaymentReceived,
      preparing:
        () =>
          renderTrackingScreen(
            'preparing',
          ),
      'on-the-way':
        () =>
          renderTrackingScreen(
            'on-the-way',
          ),
      delivered:
        () =>
          renderTrackingScreen(
            'delivered',
          ),
      cancelled:
        renderCancelled,
      'cart-cleared': () => <>
        {renderHeader('Cart cleared')}
        <div className="qb-review">
        <p className="qb-subtitle" role="status">{cartClearResult}</p>
        <button className={`qb-primary-button ${focusKey === 'shop-more' ? 'is-focused' : ''}`} {...focusableProps('shop-more')}>Shop More</button>
        </div>
      </>,
    }
    return (
      <aside
        ref={panelRef}
        data-screen={screen}
        data-vertical={vertical}
        data-focus-key={confirmStrip ? `confirm-${stripIndex}` : focusKey}
        className={`qb-panel ${
          open
            ? 'is-open'
            : ''
        } ${confirmStrip ? 'has-confirmation' : ''}`}
        aria-hidden={!open}
        inert={!open}
        aria-label="QuickBite food ordering"
        onTransitionEnd={event => {
          if (!open || event.target !== event.currentTarget || event.propertyName !== 'transform') return
          const selector = confirmStrip ? `[data-qb-confirm="${stripIndex}"]` : `[data-qb-focus="${focusKey}"]`
          panelRef.current?.querySelector(selector)?.focus({ preventScroll: true })
        }}
      >
        <header className="qb-panel-top">
          <QuickBiteLogo />
        </header>
        <main className="qb-panel-body">
          <div
            className={`qb-screen ${
              screen === 'home'
                ? 'qb-screen-full'
                : ''
            }`}
            key={screen}
            inert={Boolean(confirmStrip)}
            aria-hidden={confirmStrip ? true : undefined}
          >
            {/* One notice slot for every screen. It used to be repeated per
                screen and was present on only 11 of 18, so an agent reply
                routed to `restaurant` or `gresults` was set into state that
                nothing rendered - the user was told nothing at all. Hoisting
                it here removes the enumeration rather than extending it. */}
            {notice && (
              <p className="qb-inline-notice">
                {notice}
              </p>
            )}
            {renderers[
              screen
            ]?.()}
          </div>
        </main>
        {open && confirmStrip && (
          <div className="qb-modal-layer">
            <ConfirmStrip
              strip={confirmStrip}
              focusIndex={stripIndex}
              onFocusIndex={setStripIndex}
              onPick={(option) => handleStripPick(option)}
            />
          </div>
        )}
        <nav
          className="qb-bottom-nav"
          aria-label="QuickBite navigation"
          inert={Boolean(confirmStrip)}
          aria-hidden={confirmStrip ? true : undefined}
        >
          <button
            aria-label="Back"
            className={`qb-back-button ${
              focusKey ===
                'back'
                ? 'is-focused'
                : ''
            }`}
            {...focusableProps(
              'back',
            )}
          >
            <span aria-hidden="true">
              ←
            </span>
            <small>
              Back
            </small>
          </button>
          <button
            className={`qb-exit-button ${
              focusKey ===
                'exit'
                ? 'is-focused'
                : ''
            }`}
            {...focusableProps(
              'exit',
            )}
          >
            Exit
          </button>
        </nav>
      </aside>
    )
  },)
const STRUCTURED_ERROR_COPY = {
  restaurants:
    'No fresh structured restaurant data was returned. Please retry.',
  products:
    'No fresh structured grocery data was returned. Please retry.',
  menu:
    'No fresh structured menu data was returned for this restaurant. Please retry.',
  cart:
    'We could not load your cart details. Try again or return to the provider cart.',
  checkout:
    'We could not confirm the checkout result. Check the provider order status before trying again.',}
function structuredErrorDetail(
  error,) {
  // The backend's own explanation ("this restaurant is offline", "that item is
  // unavailable") is something the user can act on; the canned copy only says
  // the response had the wrong shape, which sends them to Retry forever on a
  // condition retrying cannot fix. Prefer the real message when there is one.
  const message =
    String(
      error?.message ??
      '',
    ).trim()
  if (
    message &&
    message !==
    'The backend did not return a cart.'
  ) {
    return message.length >
      400
      ? `${message.slice(0, 400)}\u2026`
      : message
  }
  return (
    STRUCTURED_ERROR_COPY[
      error?.kind
    ] ||
    'The provider did not supply the details needed to continue. Try again or go back.'
  )}
export default QuickBitePanel

import {
  QUICKBITE_CATEGORIES,
  QUICKBITE_DISHES,
} from './catalog.js'

import {
  GROCERY_CATEGORIES,
  GROCERY_PRODUCTS,
} from './groceryCatalog.js'

import {
  keyTermsFrom,
} from './viewContext.js'

/* The keyterm list sent with each utterance (spec §6.3: a JSON array of
 * strings, honoured only on saaras:v4).
 *
 * Two sources, in priority order, because the list is capped:
 *
 *   1. What is on screen right now — restaurant and dish names the user is
 *      looking at and most likely to say next. "Lazzat E Lucknow" came back
 *      as "Lachha to Lucknow" while it sat on the screen.
 *   2. The app's own catalogue — every dish, product, category and platform
 *      it can ever show. This is the half that matters when nothing is on
 *      screen yet: "Chole Bhature" transcribed as "Motor Chole Bhature" from
 *      the home screen, where there were no items to draw from, even though
 *      the phrase is sitting in catalog.js.
 */

/* Sarvam's hard limit: "At most 50 keyterms are allowed, got 100." Exceeding
   it 400s the whole request, so the user loses the utterance, not just the
   biasing. The list grows with what is on screen — 31+21 result cards blew
   past a 100 cap and broke every utterance after the first search. */

export const MAX_KEYTERMS = 50

const PLATFORMS = [
  'Zomato',
  'Swiggy',
  'Swiggy Instamart',
  'Zepto',
]

function catalogTerms() {
  const terms = []

  for (
    const group of [
      QUICKBITE_DISHES,
      GROCERY_PRODUCTS,
    ]
  ) {
    for (
      const entries of
      Object.values(group)
    ) {
      for (
        const entry of entries
      ) {
        if (entry?.name) {
          terms.push(
            entry.name,
          )
        }
      }
    }
  }

  for (
    const group of [
      QUICKBITE_CATEGORIES,
      GROCERY_CATEGORIES,
    ]
  ) {
    for (
      const entry of group
    ) {
      if (entry?.name) {
        terms.push(
          entry.name,
        )
      }
    }
  }

  return terms
}

export function sttKeyterms(view) {
  // On-screen first: the cap must never cut the words most likely to be said.
  const ordered = [
    ...keyTermsFrom(view),
    ...catalogTerms(),
    ...PLATFORMS,
  ]

  const seen = new Set()
  const terms = []

  for (const raw of ordered) {
    /* "Send each keyterm as a separate array item; comma-separated and
       semicolon-separated values are not supported." One restaurant name with
       a comma 400s the request and the user loses the whole utterance.
       Verified against the live API: & + = [ ] are fine, only , and ; are not. */

    for (
      const part of
      String(raw || '')
        .split(/[,;]/)
    ) {
      const term =
        part.trim()

      if (
        !term ||
        seen.has(term)
      ) {
        continue
      }

      seen.add(term)
      terms.push(term)

      if (
        terms.length ===
        MAX_KEYTERMS
      ) {
        return terms
      }
    }
  }

  return terms
}

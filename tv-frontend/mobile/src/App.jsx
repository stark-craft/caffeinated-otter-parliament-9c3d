import { useEffect } from 'react'
import useSetupStore from './store/useSetupStore'
import useSession from './hooks/useSession'
import TopBar from './components/TopBar/TopBar'
import ProgressBar from './components/ProgressBar/ProgressBar'
import UserDetails from './pages/UserDetails'
import MerchantLogin from './pages/MerchantLogin'
import SuccessScreen from './pages/SuccessScreen'

export default function App() {
    const step = useSetupStore((s) => s.step)
    const { sessionLoading, sessionValid } = useSession()

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [step])

    if (sessionLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: 'var(--muted)' }}>
                Validating session…
            </div>
        )
    }

    if (!sessionValid) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: 'var(--red)', padding: 20, textAlign: 'center' }}>
                ❌ Invalid or expired session. Please scan the QR code again from your TV.
            </div>
        )
    }

    return (
        <>
            {step < 3 && <TopBar />}
            {step < 3 && <ProgressBar />}
            {step === 1 && <UserDetails />}
            {step === 2 && <MerchantLogin />}
            {step === 3 && <SuccessScreen />}
        </>
    )
}

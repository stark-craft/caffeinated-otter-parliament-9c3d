import styles from './TopBar.module.css'
import useSetupStore from '../../store/useSetupStore'

export default function TopBar() {
    const session = useSetupStore((s) => s.session)

    return (
        <div className={styles.topbar}>
            <div className={styles.topbarIcon}>🛒</div>
            <div>
                <div className={styles.topbarName}>AgentCart</div>
                <div className={styles.topbarSub}>TV Merchant Setup</div>
            </div>
            <div className={styles.topbarSession}>Session: {session || '–'}</div>
        </div>
    )
}

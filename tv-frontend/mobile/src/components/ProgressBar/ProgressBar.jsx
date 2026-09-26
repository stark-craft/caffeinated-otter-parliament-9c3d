import styles from './ProgressBar.module.css'
import useSetupStore from '../../store/useSetupStore'

export default function ProgressBar() {
    const step = useSetupStore((s) => s.step)

    return (
        <div className={styles.progressBar}>
            {[1, 2].map((i) => (
                <div
                    key={i}
                    className={`${styles.progStep} ${i < step ? styles.done : ''} ${i === step ? styles.active : ''}`}
                />
            ))}
        </div>
    )
}

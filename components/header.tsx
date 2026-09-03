import Image from "next/image";
import styles from "./header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <Image
        className={styles.logo}
        src="/brand/logo-horizontal.png"
        alt="Strat'Edge"
        width={457}
        height={294}
        priority
      />
    </header>
  );
}

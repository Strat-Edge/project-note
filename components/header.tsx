import Image from "next/image";
import styles from "./header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      {/* Icône seule (nouveau logo, remplace l'ancien lockup horizontal icône+texte) — le nom
          "Strat'Edge" est désormais du vrai texte à côté (.logoText), pas incrusté dans
          l'image. alt="" : l'icône devient décorative, le texte visible porte déjà le nom
          pour les lecteurs d'écran (sans ce vide, "Strat'Edge" serait annoncé deux fois). */}
      <Image
        className={styles.logo}
        src="/brand/logo-icon.png"
        alt=""
        width={291}
        height={294}
        priority
      />
      <span className={styles.logoText}>Strat&apos;Edge</span>
    </header>
  );
}

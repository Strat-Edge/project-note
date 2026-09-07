import Image from "next/image";
import { AccountLink } from "./account-link";
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
      <span className={styles.logoText}>
        Strat&apos;Edge
        {/* Sur mobile, passe sous "Strat'Edge" (cf. .logoSlogan, header.module.css) — pas de
            "-" devant sur cette ligne dédiée (retour Guillaume), le séparateur " - " n'est
            ajouté qu'à partir de 768px (CSS ::before, inline à la suite du nom) quand les deux
            reviennent sur la même ligne. */}
        <span className={styles.logoSlogan}>Former pour performer</span>
      </span>

      {/* Accès à la gestion de compte (retour Guillaume : "un moyen de gérer mon compte")
          — poussé à droite via margin-left: auto (.accountLink, header.module.css). Extrait
          en composant client (masqué sur /login, cf. account-link.tsx) : Header reste un
          composant serveur pour tout le reste. */}
      <AccountLink />
    </header>
  );
}

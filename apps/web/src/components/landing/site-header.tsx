"use client";

import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "./wordmark";
import s from "./landing.module.css";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQs" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className={`${s.header} ${s.wrap}`}>
      <a className={s.logo} href="#" aria-label="BillSafi home">
        <Wordmark registered />
      </a>
      <nav
        id="landing-nav"
        className={`${s.nav} ${open ? s.open : ""}`}
        aria-label="Main navigation"
      >
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </a>
        ))}
        <Link className={s.navSignIn} href="/sign-in">
          Sign in
        </Link>
      </nav>
      <div className={s.headerActions}>
        <Link className={s.signIn} href="/sign-in">
          Sign in
        </Link>
        <Link className={`${s.button} ${s.small} ${s.dark} ${s.navCta}`} href="/sign-up">
          Create account{" "}
          <span>
            <ArrowUpRight className={s.icon} aria-hidden />
          </span>
        </Link>
      </div>
      <button
        type="button"
        className={s.menu}
        aria-label="Toggle navigation"
        aria-controls="landing-nav"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu aria-hidden />
      </button>
    </header>
  );
}

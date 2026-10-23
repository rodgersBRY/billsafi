import Image from "next/image";
import s from "./landing.module.css";

/** The landing page's BillSafi wordmark: the brand mark followed by the name. */
export function Wordmark({ registered = false }: { registered?: boolean }) {
  return (
    <>
      <Image src="/brand/logo-mark.png" alt="" width={35} height={35} className={s.brandIcon} />
      bill<span className={s.logoLight}>safi</span>
      {registered && <span className={s.brandDot}>®</span>}
    </>
  );
}

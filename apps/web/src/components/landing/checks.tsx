import { Check } from "lucide-react";
import s from "./landing.module.css";

export function Checks({ items }: { items: string[] }) {
  return (
    <ul className={s.checks}>
      {items.map((item) => (
        <li key={item}>
          <Check aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

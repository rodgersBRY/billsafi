/**
 * Bill to shows the client name first, then a different optional company name
 * beneath it (D034). Names that match after trimming and case folding appear once.
 */
export function billToLines(clientName: string, companyName?: string | null): string[] {
  const name = clientName.trim();
  const company = companyName?.trim();
  if (!company || company.localeCompare(name, undefined, { sensitivity: "accent" }) === 0) {
    return [name];
  }
  return [name, company];
}

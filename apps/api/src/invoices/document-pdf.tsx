import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { billToLines, formatPhone } from "@billsafi/domain";
import type { InvoiceLogo } from "./branding.service.js";

// White page, dark text, neutral headings, thin grey dividers, bold totals (D031).
const ink = "#111827";
const muted = "#4b5563";
const line = "#d1d5db";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, color: ink, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 0.75,
    borderColor: line,
  },
  businessBlock: { flexDirection: "row", alignItems: "flex-start" },
  logo: { maxWidth: 120, maxHeight: 48, objectFit: "contain", marginRight: 2 },
  businessName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: muted },
  label: { fontSize: 8, color: muted, letterSpacing: 1, marginBottom: 3 },
  documentNumber: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 0.75,
    borderColor: line,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.75,
    borderColor: line,
    color: muted,
    fontSize: 8,
  },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderColor: line },
  description: { flex: 1, paddingRight: 8 },
  qty: { width: 50, textAlign: "right" },
  price: { width: 80, textAlign: "right" },
  amount: { width: 90, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  strong: { fontFamily: "Helvetica-Bold" },
  divider: { borderTopWidth: 0.75, borderColor: line, marginTop: 4, paddingTop: 4 },
  section: { marginTop: 20 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: muted,
  },
});

const amountFormat = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const amount = (value: string) => amountFormat.format(Number(value));
const dateFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export const date = (value: string) => dateFormat.format(new Date(`${value}T00:00:00Z`));
const quantity = (value: string) => Number(value).toString();

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={strong ? styles.strong : styles.muted}>{label}</Text>
      <Text style={strong ? styles.strong : undefined}>{value}</Text>
    </View>
  );
}

export interface PdfDocumentView {
  /** Header label, such as INVOICE or QUOTE. */
  label: string;
  number: string;
  business: {
    displayName: string;
    contactEmail: string;
    phone: string;
    address: string | null;
    kraPin: string | null;
  };
  client: { name: string; companyName: string | null };
  /** Right-hand detail lines, already formatted, such as "Due 19 Nov 2026". */
  dates: string[];
  currency: string;
  items: {
    position: number;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  discount: { type: "fixed" | "percentage"; value: string } | null;
  discountAmount: string;
  taxRate: string | null;
  taxAmount: string;
  /** Rows under the divider. The invoice shows total, payments and balance; a quote shows its total. */
  summary: { label: string; value: string; strong?: boolean }[];
  sections: { label: string; text: string }[];
  showBranding: boolean;
}

/** One A4 template: items flow across pages with the header repeated (D025, D049). */
export function DocumentPdf({ view, logo }: { view: PdfDocumentView; logo: InvoiceLogo | null }) {
  const { business } = view;
  return (
    <Document title={`${view.number} · ${business.displayName}`} author={business.displayName}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.businessBlock}>
            {logo && (
              <Image
                style={styles.logo}
                src={{ data: logo.data, format: logo.contentType === "image/png" ? "png" : "jpg" }}
              />
            )}
            <View>
              <Text style={styles.businessName}>{business.displayName}</Text>
              <Text style={styles.muted}>{business.contactEmail}</Text>
              <Text style={styles.muted}>{formatPhone(business.phone)}</Text>
              {business.address && <Text style={styles.muted}>{business.address}</Text>}
              {business.kraPin && <Text style={styles.muted}>Tax ID {business.kraPin}</Text>}
            </View>
          </View>
          <View>
            <Text style={[styles.label, { textAlign: "right" }]}>{view.label}</Text>
            <Text style={styles.documentNumber}>{view.number}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View>
            <Text style={styles.label}>BILL TO</Text>
            {billToLines(view.client.name, view.client.companyName).map((text, index) => (
              <Text key={text} style={index === 0 ? styles.strong : styles.muted}>
                {text}
              </Text>
            ))}
          </View>
          <View>
            {view.dates.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.description}>Service</Text>
            <Text style={styles.qty}>Qty</Text>
            <Text style={styles.price}>Unit price</Text>
            <Text style={styles.amount}>Amount ({view.currency})</Text>
          </View>
          {view.items.map((item) => (
            <View key={item.position} style={styles.row} wrap={false}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.qty}>{quantity(item.quantity)}</Text>
              <Text style={styles.price}>{amount(item.unitPrice)}</Text>
              <Text style={styles.amount}>{amount(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <TotalRow label="Subtotal" value={amount(view.subtotal)} />
          {view.discount && (
            <TotalRow
              label={
                view.discount.type === "percentage"
                  ? `Discount (${Number(view.discount.value)}%)`
                  : "Discount"
              }
              value={`-${amount(view.discountAmount)}`}
            />
          )}
          {view.taxRate && (
            <TotalRow label={`Tax (${Number(view.taxRate)}%)`} value={amount(view.taxAmount)} />
          )}
          <View style={styles.divider}>
            {view.summary.map((row) => (
              <TotalRow key={row.label} label={row.label} value={row.value} strong={row.strong} />
            ))}
          </View>
        </View>

        {view.sections.map((section) => (
          <View key={section.label} style={styles.section} wrap={false}>
            <Text style={styles.label}>{section.label}</Text>
            <Text>{section.text}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>
            {view.number}
            {view.showBranding && " · Created with BillSafi"}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

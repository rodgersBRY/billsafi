import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PublicInvoice } from "@tallynest/contracts";
import { billToLines, formatKenyanPhone } from "@tallynest/domain";
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
  logo: { maxWidth: 120, maxHeight: 48, objectFit: "contain", marginBottom: 8 },
  businessName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: muted },
  label: { fontSize: 8, color: muted, letterSpacing: 1, marginBottom: 3 },
  invoiceNumber: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
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
const amount = (value: string) => amountFormat.format(Number(value));
const dateFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const date = (value: string) => dateFormat.format(new Date(`${value}T00:00:00Z`));
const quantity = (value: string) => Number(value).toString();

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={strong ? styles.strong : styles.muted}>{label}</Text>
      <Text style={strong ? styles.strong : undefined}>{value}</Text>
    </View>
  );
}

/** One A4 template: items flow across pages with the header repeated (D025, D049). */
export function InvoicePdf({
  invoice,
  logo,
}: {
  invoice: PublicInvoice;
  logo: InvoiceLogo | null;
}) {
  const { business } = invoice;
  return (
    <Document
      title={`${invoice.invoiceNumber} · ${business.displayName}`}
      author={business.displayName}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            {logo && (
              <Image
                style={styles.logo}
                src={{ data: logo.data, format: logo.contentType === "image/png" ? "png" : "jpg" }}
              />
            )}
            <Text style={styles.businessName}>{business.displayName}</Text>
            <Text style={styles.muted}>{business.contactEmail}</Text>
            <Text style={styles.muted}>{formatKenyanPhone(business.phone)}</Text>
            {business.address && <Text style={styles.muted}>{business.address}</Text>}
            {business.kraPin && <Text style={styles.muted}>KRA PIN {business.kraPin}</Text>}
          </View>
          <View>
            <Text style={[styles.label, { textAlign: "right" }]}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View>
            <Text style={styles.label}>BILL TO</Text>
            {billToLines(invoice.client.name, invoice.client.companyName).map((text, index) => (
              <Text key={text} style={index === 0 ? styles.strong : styles.muted}>
                {text}
              </Text>
            ))}
          </View>
          <View>
            <Text style={styles.muted}>Issued {date(invoice.issueDate)}</Text>
            <Text style={styles.muted}>Due {date(invoice.dueDate)}</Text>
          </View>
        </View>

        <View>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.description}>Service</Text>
            <Text style={styles.qty}>Qty</Text>
            <Text style={styles.price}>Unit price</Text>
            <Text style={styles.amount}>Amount ({invoice.currency})</Text>
          </View>
          {invoice.items.map((item) => (
            <View key={item.position} style={styles.row} wrap={false}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.qty}>{quantity(item.quantity)}</Text>
              <Text style={styles.price}>{amount(item.unitPrice)}</Text>
              <Text style={styles.amount}>{amount(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <TotalRow label="Subtotal" value={amount(invoice.subtotal)} />
          {invoice.discount && (
            <TotalRow
              label={
                invoice.discount.type === "percentage"
                  ? `Discount (${Number(invoice.discount.value)}%)`
                  : "Discount"
              }
              value={`-${amount(invoice.discountAmount)}`}
            />
          )}
          {invoice.taxRate && (
            <TotalRow
              label={`Tax (${Number(invoice.taxRate)}%)`}
              value={amount(invoice.taxAmount)}
            />
          )}
          <View style={styles.divider}>
            <TotalRow label="Invoice total" value={amount(invoice.total)} strong />
            <TotalRow label="Payments received" value={amount(invoice.paymentsReceived)} />
            <TotalRow
              label="Balance due"
              value={`${invoice.currency} ${amount(invoice.balanceDue)}`}
              strong
            />
          </View>
        </View>

        {invoice.paymentInstructions && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>PAYMENT INSTRUCTIONS</Text>
            <Text>{invoice.paymentInstructions}</Text>
          </View>
        )}
        {invoice.notes && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>NOTES</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {invoice.invoiceNumber}
            {invoice.showBranding && " · Created with TallyNest"}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

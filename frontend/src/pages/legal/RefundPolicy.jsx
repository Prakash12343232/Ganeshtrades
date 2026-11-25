import LegalPage, { LegalSection, LegalList, LegalLink } from '../../components/common/LegalPage';

export default function RefundPolicy() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      updated="26 November 2026"
      intro="This policy explains when you can cancel an order, how returns work for grocery items, and how refunds are processed. It applies to all orders placed on Ganesh Trades."
    >
      <LegalSection title="1. Cancelling an order">
        <LegalList
          items={[
            'You can cancel free of charge any time before your order is dispatched.',
            'Once an order is out for delivery, cancellation may not be possible. Please contact us immediately and we will try to help.',
            'To cancel, use the Orders page, message us on WhatsApp at +91 80104 12539, or call us with your order number.',
            'If you already paid online, a cancelled order is refunded in full.'
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Cancellation by us">
        <p>We may cancel an order if:</p>
        <LegalList
          items={[
            'An item is out of stock or unavailable.',
            'Your address is outside our delivery area.',
            'Payment fails or is reversed.',
            'The order appears fraudulent or abusive.',
            'A pricing or listing error occurred.'
          ]}
        />
        <p>If we cancel a prepaid order, you receive a full refund.</p>
      </LegalSection>

      <LegalSection title="3. Damaged, wrong or missing items">
        <LegalList
          items={[
            'Please check your order at the time of delivery.',
            'Report damaged, spoiled, wrong or missing items within 24 hours of delivery.',
            'Send your order number and clear photos of the item on WhatsApp or email.',
            'For perishable items (fruits, vegetables, dairy, bread, etc.) we may not ask you to return the item; we will arrange a refund or khata adjustment after verification.'
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Refund methods and timelines">
        <LegalList
          items={[
            'Online payments: refunded to the original payment method within 3–5 business days after approval.',
            'Cash on delivery: refunded by UPI or bank transfer within 3–5 business days, or credited to your khata if you prefer.',
            'Khata (credit) payments: your balance is adjusted within 1 business day.',
            'Bank or payment-provider delays are outside our control.'
          ]}
        />
      </LegalSection>

      <LegalSection title="5. When refunds are not available">
        <LegalList
          items={[
            'Change of mind after dispatch for perishable goods.',
            'Items that have been used, consumed or damaged after delivery.',
            'Reports made after 24 hours of delivery, where verification is no longer possible.',
            'Delays caused by events beyond our reasonable control.'
          ]}
        />
      </LegalSection>

      <LegalSection title="6. How to request a refund">
        <p>
          Use the Orders page or contact us with your order number:
        </p>
        <LegalList
          items={[
            'WhatsApp / Phone: +91 80104 12539',
            'Email: info@ganeshtrades.com',
            'Hours: Monday to Saturday, 10:00 AM to 6:00 PM IST'
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Grievance escalation">
        <p>
          If your complaint is not resolved, please contact our{' '}
          <LegalLink to="/contact">Grievance Officer</LegalLink>. We acknowledge complaints within 48 hours
          and aim to resolve them within 30 days. You may also contact the National Consumer Helpline on
          1915 or at consumerhelpline.gov.in.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import LegalPage, { LegalSection, LegalList, LegalLink } from '../../components/common/LegalPage';

export default function ShippingPolicy() {
  return (
    <LegalPage
      title="Shipping & Delivery Policy"
      updated="26 November 2026"
      intro="This policy explains where we deliver, the delivery options available, charges and what happens if something goes wrong with your delivery."
    >
      <LegalSection title="1. Delivery area">
        <p>
          We deliver only within our serviceable radius. The exact limit is shown when you check your
          location at checkout or in your profile. If your address is outside the area, the order cannot be
          placed and any prepaid amount is refunded.
        </p>
      </LegalSection>

      <LegalSection title="2. Delivery options">
        <LegalList
          items={[
            'Instant / ASAP delivery: we deliver as soon as your order is packed, subject to availability.',
            'Scheduled delivery: choose a date and a time slot up to 30 days in advance.',
            'Delivery slots run from 8:00 AM to 10:00 PM.'
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Delivery charges">
        <p>
          Delivery is currently free. If delivery charges apply, they are shown clearly in the cart before
          you place the order.
        </p>
      </LegalSection>

      <LegalSection title="4. Order tracking">
        <p>
          You can follow your order on the Orders page and through in-app notifications. You will be
          notified when your order is confirmed, packed, out for delivery and delivered.
        </p>
      </LegalSection>

      <LegalSection title="5. Receiving your order">
        <LegalList
          items={[
            'Please keep your phone reachable around the delivery time.',
            'Check the items at the time of delivery.',
            'Report damaged, spoiled, wrong or missing items within 24 hours — see our Refund & Cancellation Policy.',
            'If you are unavailable, we may attempt delivery again or cancel the order. Perishable items may not be re-deliverable.'
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Delays">
        <p>
          Delivery times are estimates. Weather, traffic, festivals, strikes or other events beyond our
          control may cause delays. We will keep you informed where possible.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact us">
        <p>
          For delivery questions, contact us on WhatsApp or phone at +91 80104 12539, or email{' '}
          <a href="mailto:info@ganeshtrades.com" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">info@ganeshtrades.com</a>.
          See also our <LegalLink to="/contact">Contact &amp; Grievance</LegalLink> page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

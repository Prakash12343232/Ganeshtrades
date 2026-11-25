import LegalPage, { LegalSection, LegalList, LegalLink } from '../../components/common/LegalPage';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="26 November 2026"
      intro="These terms govern your use of the Ganesh Trades website and app and the purchase of products from us. By creating an account or placing an order, you agree to these terms."
    >
      <LegalSection title="1. Acceptance of terms">
        <p>
          By accessing or using this website, registering an account or placing an order, you agree to be
          bound by these Terms of Service, our <LegalLink to="/privacy-policy">Privacy Policy</LegalLink>,{' '}
          <LegalLink to="/refund-policy">Refund &amp; Cancellation Policy</LegalLink> and{' '}
          <LegalLink to="/shipping-policy">Shipping &amp; Delivery Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and your account">
        <LegalList
          items={[
            'You must be at least 18 years old and legally able to enter into contracts.',
            'You must provide accurate name, mobile number, address and other details, and keep them up to date.',
            'You are responsible for keeping your password and Google account secure. Notify us immediately of unauthorised use.',
            'We may suspend or deactivate accounts used for fraud, abuse or repeated violations of these terms.'
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Products and pricing">
        <LegalList
          items={[
            'All prices are shown in Indian Rupees (INR).',
            'Product images are for representation; actual packaging, brand or appearance may vary.',
            'Loose items (such as grains, pulses and spices) are billed per kilogram based on the quantity you enter. Minimum order quantities apply.',
            'Prices and availability may change without notice. We try to keep all information accurate.',
            'If a product is listed at an incorrect price or is unavailable, we may cancel the order and refund any amount already paid.'
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Orders and acceptance">
        <p>
          Placing an order is an offer to buy. An order is accepted when we confirm and begin processing it.
          We may refuse or cancel an order if the product is out of stock, your address is outside our
          delivery area, payment fails, the order appears fraudulent, or there is a pricing error.
        </p>
      </LegalSection>

      <LegalSection title="5. Payments and credit (khata)">
        <LegalList
          items={[
            'We accept online payment modes, cash on delivery and approved credit (khata) accounts.',
            'Credit is subject to limits set by us and must be cleared within the agreed period.',
            'We do not store card numbers, UPI PINs or net-banking credentials.',
            'You are responsible for any charges levied by your bank or payment provider.'
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Delivery">
        <p>
          Delivery is available only within our serviceable area, which is checked at checkout. Delivery
          timings and slots are estimates and may be affected by weather, traffic or other conditions. See
          our <LegalLink to="/shipping-policy">Shipping &amp; Delivery Policy</LegalLink> for details.
        </p>
      </LegalSection>

      <LegalSection title="7. Cancellations and refunds">
        <p>
          Cancellations, returns and refunds are governed by our{' '}
          <LegalLink to="/refund-policy">Refund &amp; Cancellation Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="8. Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            'Place fake, bulk or abusive orders, or misuse offers.',
            'Attempt to access other users’ accounts or our internal systems.',
            'Copy, scrape or reverse engineer the website or its content.',
            'Use the service for any unlawful purpose or in violation of applicable Indian law.'
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Intellectual property and reviews">
        <p>
          The Ganesh Trades name, logo, website design and content belong to us or our licensors. You may
          not use them without permission. By posting a review or other content, you grant us a
          non-exclusive, royalty-free licence to display and use that content on our platforms. We may
          remove abusive or unlawful content.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          To the extent permitted by law, our total liability for any claim arising out of an order is
          limited to the amount paid for that order. We are not liable for indirect or consequential losses,
          or for delays caused by events beyond our reasonable control.
        </p>
      </LegalSection>

      <LegalSection title="11. Indemnity">
        <p>
          You agree to indemnify Ganesh Trades against claims, losses or costs arising from your misuse of
          the service or violation of these terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction
          of the courts at our place of business.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact and grievances">
        <p>
          For questions or complaints, see our <LegalLink to="/contact">Contact &amp; Grievance</LegalLink>{' '}
          page or email{' '}
          <a href="mailto:info@ganeshtrades.com" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">info@ganeshtrades.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to these terms">
        <p>
          We may update these terms from time to time. The "Last updated" date above shows the latest
          version. Continued use of the service after changes means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import LegalPage, { LegalSection, LegalList, LegalLink } from '../../components/common/LegalPage';

export default function Contact() {
  return (
    <LegalPage
      title="Contact & Grievance Redressal"
      updated="26 November 2026"
      intro="We are here to help with orders, deliveries, refunds, privacy requests and any other complaint. You can reach us through any of the channels below."
    >
      <LegalSection title="1. Contact Ganesh Trades">
        <LegalList
          items={[
            'Phone / WhatsApp: +91 80104 12539',
            'Email: info@ganeshtrades.com',
            'Address: Ganesh Trades, Main Market, Local',
            'Hours: Monday to Saturday, 10:00 AM to 6:00 PM IST'
          ]}
        />
        <p>
          For order-specific issues, please keep your order number ready. You can also message us on{' '}
          <a
            href="https://wa.me/918010412539?text=Hi%20Ganesh%20Trades!"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mint-600 dark:text-mint-400 font-semibold hover:underline"
          >
            WhatsApp
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Grievance Officer">
        <p>
          <strong>Grievance Officer, Ganesh Trades</strong><br />
          Email:{' '}
          <a href="mailto:info@ganeshtrades.com" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">info@ganeshtrades.com</a>{' '}
          · Phone: +91 80104 12539<br />
          Address: Main Market, Local<br />
          Hours: Monday to Saturday, 10:00 AM to 6:00 PM IST
        </p>
      </LegalSection>

      <LegalSection title="3. Response timelines">
        <LegalList
          items={[
            'We acknowledge complaints within 48 hours of receipt.',
            'We aim to resolve complaints within 30 days.',
            'For complaints about content or information on the platform, we acknowledge within 24 hours and aim to resolve within 15 days, as required under the IT Rules, 2021.'
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Privacy and data protection complaints">
        <p>
          If you are not satisfied with our response to a privacy request, you may complain to the Data
          Protection Board of India under the Digital Personal Data Protection Act, 2023. See our{' '}
          <LegalLink to="/privacy-policy">Privacy Policy</LegalLink> for your rights and how to exercise
          them.
        </p>
      </LegalSection>

      <LegalSection title="5. Consumer complaints">
        <p>
          You may also contact the National Consumer Helpline on 1915 or visit{' '}
          <a
            href="https://consumerhelpline.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mint-600 dark:text-mint-400 font-semibold hover:underline"
          >
            consumerhelpline.gov.in
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="6. Our policies">
        <LegalList
          items={[
            <>
              <LegalLink to="/privacy-policy">Privacy Policy</LegalLink>
            </>,
            <>
              <LegalLink to="/terms">Terms of Service</LegalLink>
            </>,
            <>
              <LegalLink to="/refund-policy">Refund &amp; Cancellation Policy</LegalLink>
            </>,
            <>
              <LegalLink to="/shipping-policy">Shipping &amp; Delivery Policy</LegalLink>
            </>
          ]}
        />
      </LegalSection>
    </LegalPage>
  );
}

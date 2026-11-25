import LegalPage, { LegalSection, LegalList, LegalLink } from '../../components/common/LegalPage';

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="26 November 2026"
      intro="Ganesh Trades respects your privacy. This policy explains what personal data we collect, why we collect it, how we protect it, and the rights you have under the Digital Personal Data Protection Act, 2023 (DPDP Act) and other applicable Indian laws."
    >
      <LegalSection title="1. Who we are">
        <p>
          Ganesh Trades ("we", "us", "our") is a grocery and wholesale business operating this website and
          app. We are the Data Fiduciary for the personal data described in this policy.
        </p>
        <p>
          Contact: <a href="mailto:info@ganeshtrades.com" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">info@ganeshtrades.com</a>{' '}
          · +91 80104 12539 · Main Market, Local.
        </p>
      </LegalSection>

      <LegalSection title="2. Consent">
        <p>
          By creating an account, placing an order or continuing to use the website, you consent to the
          collection and use of your personal data as described in this policy. You may withdraw consent at
          any time by contacting us or by deleting your account. Withdrawal may mean we can no longer provide
          services that need that data.
        </p>
      </LegalSection>

      <LegalSection title="3. Personal data we collect">
        <LegalList
          items={[
            'Account data: name, mobile number, optional email address, and password (stored only as a secure hash).',
            'Google sign-in data: if you choose "Sign in with Google", we receive your Google account ID, name and email address from Google.',
            'Delivery data: address, area, city, pincode and map coordinates. Location is captured only when you tap the location button in the app.',
            'Order data: items ordered, quantities, amounts, payment method, delivery slot, order notes and order history.',
            'Support data: messages you send us on WhatsApp, phone or email.',
            'Technical data: IP address, browser/device details and session information used for security, fraud prevention and keeping you signed in.'
          ]}
        />
        <p>
          We do not store your card number, UPI PIN, net-banking password or similar payment credentials.
        </p>
      </LegalSection>

      <LegalSection title="4. Why we use your data">
        <LegalList
          items={[
            'To create and secure your account, verify your mobile number and keep you signed in.',
            'To accept, prepare, pack and deliver your orders, and to contact you about them.',
            'To check whether your address is inside our delivery area.',
            'To process payments, credit (khata) balances and refunds.',
            'To send order updates, delivery notifications and service messages.',
            'To prevent fraud, abuse and unauthorised access.',
            'To comply with tax, accounting and other legal obligations.'
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Sharing your data">
        <p>We do not sell your personal data. We share it only as needed with:</p>
        <LegalList
          items={[
            'Our delivery staff and delivery partners, to deliver your order.',
            'Our SMS/OTP provider, to send login and verification codes.',
            'Google, when you choose Google sign-in (Google processes this under its own privacy policy).',
            'Our hosting and infrastructure providers (Render for the backend and Vercel for the website), who store data on our behalf.',
            'Government authorities or courts, when required by law or to protect our legal rights.'
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Cookies and browser storage">
        <p>
          We use only essential cookies and browser storage needed to run the service:
        </p>
        <LegalList
          items={[
            'A secure, httpOnly refresh cookie that keeps your session active.',
            'Browser session storage for your login token and basic profile while the tab is open.',
            'Local storage for your cart, theme preference and cookie consent choice.'
          ]}
        />
        <p>
          We do not use advertising, tracking or third-party analytics cookies. You can clear these items
          from your browser settings, but some features (such as staying signed in or your cart) may stop
          working.
        </p>
      </LegalSection>

      <LegalSection title="7. How long we keep data">
        <p>
          Account data is kept while your account is active. When you delete your account, we erase your
          personal identifiers (name, mobile, email, Google link, password and address) from your profile.
          Order and invoice records are retained for the period required by applicable tax and accounting
          laws; where possible, these records are kept in anonymised form.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>Under the DPDP Act you have the right to:</p>
        <LegalList
          items={[
            'Access a summary of the personal data we hold about you and how it is processed.',
            'Correct or update inaccurate data (Profile → Edit Profile).',
            'Erase your data (Profile → Security & Accounts → Delete My Account).',
            'Withdraw consent at any time.',
            'Nominate a person to exercise your rights in the event of death or incapacity.',
            'Complain to our Grievance Officer, and if unresolved, to the Data Protection Board of India.'
          ]}
        />
        <p>
          To exercise any right, email us at{' '}
          <a href="mailto:info@ganeshtrades.com" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">info@ganeshtrades.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          Passwords are stored as one-way hashes, sessions use short-lived access tokens with secure refresh
          cookies, and access to customer data is restricted to authorised staff. Please keep your password
          confidential and tell us immediately if you suspect unauthorised access.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          Our services are intended for persons aged 18 and above. We do not knowingly collect personal data
          of children. If you believe a child has provided data, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this policy from time to time. The "Last updated" date above shows the latest
          version. Material changes will be notified on the website or by message.
        </p>
      </LegalSection>

      <LegalSection title="12. Grievance Officer">
        <p>
          <strong>Grievance Officer, Ganesh Trades</strong><br />
          Email:{' '}
          <a href="mailto:info@ganeshtrades.com" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">info@ganeshtrades.com</a>{' '}
          · Phone: +91 80104 12539<br />
          Address: Main Market, Local<br />
          Hours: Monday to Saturday, 10:00 AM to 6:00 PM IST
        </p>
        <p>
          We acknowledge complaints within 48 hours and aim to resolve them within 30 days. See also our{' '}
          <LegalLink to="/contact">Contact &amp; Grievance</LegalLink> page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

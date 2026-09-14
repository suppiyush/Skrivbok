import { useNavigate } from 'react-router-dom'

export default function RefundPolicy() {
  const navigate = useNavigate()
  return (
    <>
      <style>{`
        .legal-page{font-family:'DM Sans',sans-serif;background:#f7f5f0;min-height:100vh;color:#1a1917}
        .legal-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(247,245,240,0.95);backdrop-filter:blur(10px);border-bottom:1px solid #e8e4dd;padding:16px 40px;display:flex;justify-content:space-between;align-items:center}
        .legal-logo{display:flex;align-items:center;gap:10px;cursor:pointer}
        .legal-logo-icon{width:36px;height:36px;background:#c85c2e;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white}
        .legal-logo-text{font-family:'Fraunces',serif;font-size:1.3rem;font-weight:600;color:#1a1917}
        .legal-back{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#c85c2e;border-radius:8px;color:white;font-size:0.85rem;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.2s}
        .legal-back:hover{background:#b0502a;transform:translateY(-1px)}
        .legal-hero{padding:140px 40px 60px;text-align:center;background:linear-gradient(180deg,#f7f5f0 0%,#fff 100%);position:relative;overflow:hidden}
        .legal-hero h1{font-family:'Fraunces',serif;font-size:2.8rem;font-weight:400;color:#1a1917;margin-bottom:16px}
        .legal-hero p{color:#7a766f;font-size:1rem;max-width:600px;margin:0 auto}
        .legal-content{max-width:800px;margin:0 auto;padding:40px 40px 100px}
        .legal-content h2{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:500;color:#1a1917;margin:40px 0 16px;padding-bottom:8px;border-bottom:2px solid #f4ede7}
        .legal-content h3{font-size:1.1rem;font-weight:600;color:#1a1917;margin:28px 0 12px}
        .legal-content p{color:#4a4741;font-size:0.95rem;line-height:1.8;margin-bottom:16px}
        .legal-content ul{padding-left:24px;margin-bottom:16px}
        .legal-content li{color:#4a4741;font-size:0.95rem;line-height:1.8;margin-bottom:8px}
        .legal-content strong{color:#1a1917}
        .legal-highlight{background:#f4ede7;border-radius:12px;padding:20px 24px;margin:20px 0;border-left:4px solid #c85c2e}
        .legal-highlight p{color:#1a1917;margin-bottom:0}
        .legal-footer{background:#1a1917;padding:40px;text-align:center}
        .legal-footer p{color:rgba(255,255,255,0.5);font-size:0.85rem}
      `}</style>
      <div className="legal-page">
        <nav className="legal-nav">
          <div className="legal-logo" onClick={() => navigate('/')}>
            <div className="legal-logo-icon"><i className="fas fa-rocket" /></div>
            <span className="legal-logo-text">Skrivbok</span>
          </div>
          <button className="legal-back" onClick={() => navigate('/')}>
            <i className="fas fa-arrow-left" /> Back to Home
          </button>
        </nav>
        <section className="legal-hero">
          <h1>Refund Policy</h1>
          <p>Last updated: May 12, 2026</p>
        </section>
        <div className="legal-content">
          <p>Thank you for using Skrivbok. We strive to provide services to all our users. Before requesting a refund, please review the following refund policy carefully to determine whether your purchase is eligible.</p>

          <h2>Non-Refundable Cases</h2>
          <p>The following situations are generally not eligible for refunds:</p>
          <ul>
            <li>The subscription, license, credits, usage hours, tokens, or purchased digital resources have already been fully or partially used.</li>
            <li>The refund request is submitted after 30 days from the original purchase date.</li>
            <li>Dissatisfaction based solely on personal preference, change of mind, or unmet expectations regarding features or outcomes.</li>
            <li>Unauthorized payments caused by credit card misuse, fraud, or third-party access. In such cases, users are advised to contact their payment provider or bank immediately.</li>
            <li>Price differences due to regional pricing, promotional offers, discounts, taxes, exchange rates, or special campaigns.</li>
            <li>Refund requests for partially used subscriptions.</li>
            <li>Duplicate purchases caused by user error where services have already been accessed or used.</li>
            <li>Technical issues caused by user devices, internet connectivity, unsupported systems, or failure to follow provided instructions.</li>
            <li>Refund requests where the user refuses to cooperate with our support team for troubleshooting or resolution attempts.</li>
            <li>Purchases made through third-party sellers, marketplaces, app stores, resellers, or external platforms. Refund requests for such purchases must be directed to the original seller or platform.</li>
            <li>Any violation of our Terms &amp; Conditions or misuse of the platform.</li>
          </ul>

          <h2>General Refund Rules</h2>
          <p>Unless otherwise required by applicable law, all payments made to Skrivbok are generally non-refundable once digital services, subscriptions, or content access have been activated or used.</p>
          <p>Refund eligibility is determined solely at the discretion of Skrivbok after reviewing the request and purchase details.</p>

          <h2>Eligible Refund Cases</h2>
          <p>Refunds may be considered in the following situations:</p>
          <ul>
            <li>You were charged multiple times for the same product or subscription.</li>
            <li>You accidentally purchased the wrong product or plan and have not used the purchased service.</li>
            <li>You were unable to access the purchased service due to a verified technical issue that could not be resolved within a reasonable timeframe.</li>
            <li>You did not receive access credentials, confirmation email, or activation after purchase and our support team could not resolve the issue.</li>
            <li>Billing errors or duplicate transactions occurred due to system malfunction.</li>
            <li>The purchased service was not delivered as described due to a verified platform-side issue.</li>
          </ul>

          <h2>Subscription Cancellation</h2>
          <p>Users may cancel recurring subscriptions at any time before the next billing cycle. Cancellation prevents future charges but does not automatically guarantee a refund for previous payments already processed.</p>

          <h2>Refund Process</h2>
          <p>To request a refund, please contact our support team with:</p>
          <ul>
            <li>Your order number,</li>
            <li>Purchase email address,</li>
            <li>Payment details,</li>
            <li>Reason for the refund request.</li>
          </ul>
          <p>Refund requests will be reviewed within a reasonable period. Approved refunds will generally be processed using the original payment method.</p>

          <h2>License &amp; Access Termination</h2>
          <p>Once a refund is issued, access to the purchased subscription may be suspended or permanently terminated. Continued use after refund approval is prohibited.</p>

          <h2>Contact Us</h2>
          <p>For refund requests or billing support, please contact:</p>
          <p><strong>Website:</strong> <a onClick={() => navigate('/')} style={{ color: '#c85c2e', cursor: 'pointer', textDecoration: 'underline' }}>Skrivbok</a><br /><strong>Support Email:</strong> support@skrivbok.com</p>
        </div>
        <footer className="legal-footer">
          <p>© 2026 Skrivbok. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

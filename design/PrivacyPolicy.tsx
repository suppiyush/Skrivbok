import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicy() {
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
          <h1>Privacy Policy</h1>
          <p>Last updated: May 12, 2026</p>
        </section>
        <div className="legal-content">
          <p><strong>IMPORTANT: THIS IS A LICENSE, NOT A SALE</strong></p>
          <p>This Skrivbok License Agreement is between the end user (hereinafter referred to as You or Licensee), and Skrivbok.</p>
          <p><strong>IMPORTANT:</strong> Skrivbok's PRIVACY POLICY EXPLAINS HOW WE COLLECT, TREAT YOUR PERSONAL DATA AND PROTECT YOUR PRIVACY WHEN YOU USE OUR SERVICES. BY USING OUR SERVICES, YOU AGREE TO BE BOUND BY THE PRIVACY POLICY OR PRIVACY NOTICE PUBLISHED BY SKRIVBOK ON ITS WEBSITE. BY DOWNLOADING, ACCESSING, INSTALLING OR USING THE SERVICE, YOU ALSO AGREE TO BE BOUND BY THE FOLLOWING TERMS AND CONDITIONS OF THIS AGREEMENT.</p>
          <p>Please read this agreement carefully before using this website. Top attention should be paid to such clauses including but not limited to Article 3, 5, 14, 15, 16, 19. If you disagree with or have any questions concerning this END USER LICENSE AGREEMENT (EULA), please contact Skrivbok. Any installing, copying, accessing, or using the Licensed Software by you (the "Licensee") constitutes an acceptance of, and a promise to comply with, all the terms and conditions of this EULA</p>

          <h2>Terms and Conditions:</h2>

          <h2>1. Services</h2>
          <p>Skrivbok provides digital tools, AI-powered writing assistance, content creation services, and related online features ("Services"). All services are provided subject to these Terms.</p>

          <h2>2. License &amp; Permitted Use</h2>
          <p>Subject to compliance with these Terms, Skrivbok grants you a limited, non-exclusive, non-transferable, revocable license to access and use the platform for personal or authorized business purposes.</p>
          <p>You may not:</p>
          <ul>
            <li>Copy, distribute, resell, sublicense, or commercially exploit the platform without written permission.</li>
            <li>Reverse engineer, decompile, modify, or attempt to extract source code.</li>
            <li>Use the platform for illegal, harmful, fraudulent, or unauthorized purposes.</li>
            <li>Share account credentials or provide unauthorized access to others.</li>
            <li>Use automated systems, bots, or scraping tools without authorization.</li>
          </ul>
          <p>All rights not expressly granted remain reserved by Skrivbok.</p>

          <h2>3. User Accounts</h2>
          <p>You may be required to create an account to access certain services.</p>
          <p>You are responsible for:</p>
          <ul>
            <li>Maintaining account confidentiality,</li>
            <li>All activities under your account,</li>
            <li>Providing accurate and current information.</li>
          </ul>
          <p>Skrivbok reserves the right to suspend or terminate accounts that violate these Terms.</p>

          <h2>4. User Content</h2>
          <p>You retain ownership of the content you create or upload using Skrivbok ("User Content").</p>
          <p>By using the platform, you grant Skrivbok a limited license to process, store, display, and use your content solely for operating, improving, and providing the Services.</p>
          <p>You agree not to upload or generate content that:</p>
          <ul>
            <li>Violates laws or regulations,</li>
            <li>Infringes intellectual property rights,</li>
            <li>Contains harmful, abusive, defamatory, or illegal material,</li>
            <li>Violates privacy or third-party rights.</li>
          </ul>
          <p>You are solely responsible for your User Content.</p>

          <h2>5. AI-Generated Content</h2>
          <p>Skrivbok may provide AI-generated outputs and suggestions. Due to the nature of artificial intelligence, outputs may not always be accurate, unique, or suitable for every purpose.</p>
          <p>Users are solely responsible for reviewing, verifying, and using generated content appropriately.</p>
          <p>Skrivbok does not guarantee the accuracy, legality, or reliability of AI-generated content.</p>

          <h2>6. Subscriptions &amp; Payments</h2>
          <p>Certain features may require paid subscriptions or one-time purchases.</p>
          <p>By purchasing a service, you agree to:</p>
          <ul>
            <li>Pay all applicable charges,</li>
            <li>Authorize recurring billing where applicable,</li>
            <li>Provide valid payment information.</li>
          </ul>
          <p>Subscription plans automatically renew unless canceled before the renewal date.</p>

          <h2>7. Refund Policy</h2>
          <p>Refunds are governed by our Refund Policy available at:</p>
          <p><a onClick={() => navigate('/refund-policy')} style={{ color: '#c85c2e', cursor: 'pointer', textDecoration: 'underline' }}>Skrivbok Refund Policy</a></p>

          <h2>8. Intellectual Property</h2>
          <p>All platform content, branding, software, designs, logos, graphics, and technology are owned by or licensed to Skrivbok and protected by intellectual property laws.</p>
          <p>You may not use Skrivbok trademarks, branding, or copyrighted material without prior written permission.</p>

          <h2>9. Third-Party Services</h2>
          <p>Skrivbok may integrate or link to third-party services, tools, or websites.</p>
          <p>We are not responsible for:</p>
          <ul>
            <li>Third-party content,</li>
            <li>Availability of third-party services,</li>
            <li>External privacy practices or policies.</li>
          </ul>
          <p>Use of third-party services is at your own risk.</p>

          <h2>10. Privacy</h2>
          <p>Your use of the platform is also governed by our Privacy Policy:</p>
          <p><a onClick={() => navigate('/privacy-policy')} style={{ color: '#c85c2e', cursor: 'pointer', textDecoration: 'underline' }}>Skrivbok Privacy Policy</a></p>

          <h2>11. Disclaimer of Warranties</h2>
          <p>The platform and services are provided on an "as is" and "as available" basis.</p>
          <p>Skrivbok makes no warranties regarding:</p>
          <ul>
            <li>Accuracy or reliability,</li>
            <li>Continuous availability,</li>
            <li>Error-free operation,</li>
            <li>Fitness for a particular purpose.</li>
          </ul>
          <p>Use of the platform is at your own risk.</p>

          <h2>12. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Skrivbok shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:</p>
          <ul>
            <li>Use or inability to use the platform,</li>
            <li>AI-generated outputs,</li>
            <li>Loss of data, profits, or business opportunities,</li>
            <li>Unauthorized access or security breaches.</li>
          </ul>
          <p>Our total liability shall not exceed the amount paid by you for the applicable service in the preceding 12 months.</p>

          <h2>13. Termination</h2>
          <p>Skrivbok reserves the right to suspend or terminate access to the Services at any time if you violate these Terms or misuse the platform.</p>
          <p>Upon termination, your right to access and use the Services will immediately cease.</p>

          <h2>14. Governing Law</h2>
          <p>These Terms shall be governed by and interpreted in accordance with the laws of India.</p>
          <p>Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts located in Rajasthan, India.</p>

          <h2>15. Changes to Terms</h2>
          <p>Skrivbok may update or modify these Terms at any time. Continued use of the platform after changes become effective constitutes acceptance of the revised Terms.</p>

          <h2>16. Contact Us</h2>
          <p>For support or legal inquiries:</p>
          <p><strong>Website:</strong> <a onClick={() => navigate('/')} style={{ color: '#c85c2e', cursor: 'pointer', textDecoration: 'underline' }}>Skrivbok</a><br /><strong>Email:</strong> support@skrivbok.com</p>
          <p style={{ marginTop: '32px', fontStyle: 'italic', color: '#7a766f' }}>By using Skrivbok, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.</p>
        </div>
        <footer className="legal-footer">
          <p>© 2026 Skrivbok. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

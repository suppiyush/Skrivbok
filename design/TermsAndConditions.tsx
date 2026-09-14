import { useNavigate } from 'react-router-dom'

export default function TermsAndConditions() {
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
        .legal-hero::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:800px;height:800px;background:radial-gradient(circle,rgba(200,92,46,0.06) 0%,transparent 70%);pointer-events:none}
        .legal-hero h1{font-family:'Fraunces',serif;font-size:2.8rem;font-weight:400;color:#1a1917;margin-bottom:16px;letter-spacing:-0.02em}
        .legal-hero p{color:#7a766f;font-size:1rem;max-width:600px;margin:0 auto}
        .legal-content{max-width:800px;margin:0 auto;padding:40px 40px 100px}
        .legal-content h2{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:500;color:#1a1917;margin:40px 0 16px;padding-bottom:8px;border-bottom:2px solid #f4ede7}
        .legal-content h3{font-size:1.1rem;font-weight:600;color:#1a1917;margin:28px 0 12px}
        .legal-content p{color:#4a4741;font-size:0.95rem;line-height:1.8;margin-bottom:16px}
        .legal-content ul{padding-left:24px;margin-bottom:16px}
        .legal-content li{color:#4a4741;font-size:0.95rem;line-height:1.8;margin-bottom:8px}
        .legal-content strong{color:#1a1917}
        .legal-footer{background:#1a1917;padding:40px;text-align:center;border-top:1px solid rgba(255,255,255,0.1)}
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
          <h1>Terms and Conditions</h1>
          <p>Last updated: May 12, 2026</p>
        </section>

        <div className="legal-content">
          <p>Welcome to Skrivbok. By accessing or using this website, you agree to comply with and be bound by the following Terms &amp; Conditions. If you do not agree with any part of these terms, please do not use this website.</p>
          <p>Skrivbok reserves the right to modify, update, or change these Terms &amp; Conditions at any time without prior notice. Continued use of the website following any changes constitutes acceptance of those changes.</p>
          <p>Any rights not expressly granted herein are reserved.</p>

          <h2>Use of Website</h2>
          <p>You may access and use this website solely for lawful purposes and in accordance with these Terms &amp; Conditions. You agree not to misuse the website, interfere with its operation, or attempt unauthorized access to any part of the platform, servers, or connected networks.</p>
          <p>There are inherent risks associated with the use of internet-based services and downloadable content. Skrivbok advises users to ensure proper security measures, including virus protection and data backups. You are solely responsible for protecting your devices, systems, and data while using this website.</p>

          <h2>Intellectual Property</h2>
          <p>All content available on this website, including but not limited to text, graphics, logos, icons, images, videos, software, designs, layouts, and trademarks (collectively, "Content"), is owned by or licensed to Skrivbok and is protected under applicable copyright, trademark, and intellectual property laws.</p>
          <p>Except as expressly permitted, you may not copy, reproduce, distribute, modify, publish, transmit, display, sell, or exploit any Content without prior written permission from Skrivbok.</p>

          <h2>Images, Logos &amp; Trademarks</h2>
          <p>All logos, page headers, graphics, icons, and service names displayed on this website are trademarks, service marks, or trade dress of Skrivbok or its licensors.</p>
          <p>Unauthorized use, copying, imitation, or distribution of any trademarks or branding materials is strictly prohibited and may violate applicable laws.</p>

          <h2>User Content</h2>
          <p>Users may submit or upload content to the website where applicable. You agree not to upload unlawful, defamatory, harmful, infringing, or misleading material. By submitting any content, you grant Skrivbok a non-exclusive, worldwide, royalty-free license to modify such content for operating and improving the platform.</p>

          <h2>Indemnity</h2>
          <p>You agree to defend, indemnify, and hold harmless Skrivbok, its affiliates, partners, employees, directors, and agents from and against any claims, liabilities, damages, losses, expenses, or costs, including legal fees, arising from:</p>
          <ul>
            <li>Your use of the website,</li>
            <li>Your violation of these Terms,</li>
            <li>Your infringement of any third-party rights,</li>
            <li>Any content submitted by you.</li>
          </ul>

          <h2>Feedback</h2>
          <p>Any suggestions, comments, ideas, feedback, or recommendations submitted to Skrivbok regarding the website or services shall be considered non-confidential and non-proprietary.</p>
          <p>Skrivbok shall be free to use, reproduce, modify, publish, or distribute such feedback without restriction or compensation to the user.</p>

          <h2>Third-Party Links</h2>
          <p>This website may contain links to third-party websites or services for user convenience. Skrivbok does not control or endorse such third-party websites and is not responsible for their content, policies, or practices.</p>
          <p>Users access third-party websites at their own risk.</p>

          <h2>Disclaimer of Warranties</h2>
          <p>All services and information provided on this website are offered on an "as is" and "as available" basis without warranties of any kind, whether express or implied.</p>
          <p>Skrivbok does not guarantee uninterrupted access, accuracy, reliability, or error-free operation of the website or services.</p>

          <h2>Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Skrivbok shall not be liable for any indirect, incidental, consequential, special, or punitive damages arising from the use of or inability to use the website or services.</p>

          <h2>Copyright Policy</h2>
          <p>All materials on this website are protected by applicable copyright laws. Unauthorized copying, reproduction, or redistribution of any material from this website is prohibited without prior written consent from Skrivbok.</p>
          <p>You may not remove, alter, or obscure any copyright, trademark, or proprietary notices.</p>

          <h2>Privacy</h2>
          <p>Your use of the website is also governed by our Privacy Policy available on <a onClick={() => navigate('/privacy-policy')} style={{ color: '#c85c2e', cursor: 'pointer', textDecoration: 'underline' }}>Skrivbok Privacy Policy</a>.</p>

          <h2>Termination</h2>
          <p>Skrivbok reserves the right to suspend or terminate user access to the website at any time without prior notice if any violation of these Terms &amp; Conditions is detected.</p>

          <h2>Governing Law</h2>
          <p>These Terms &amp; Conditions shall be governed and interpreted in accordance with the applicable laws of India, without regard to conflict of law principles.</p>
          <p>Any disputes arising in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in Jammu and Kashmir, India.</p>

          <h2>Contact Information</h2>
          <p>For questions, support, or legal concerns regarding these Terms &amp; Conditions, please contact:</p>
          <p><strong>Website:</strong> Skrivbok.com<br /><strong>Email:</strong> support.skrivbok@gmail.com</p>
          <p style={{ marginTop: '32px', fontStyle: 'italic', color: '#7a766f' }}>By using this website, you acknowledge that you have read, understood, and agreed to these Terms &amp; Conditions.</p>
        </div>

        <footer className="legal-footer">
          <p>© 2026 Skrivbok. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

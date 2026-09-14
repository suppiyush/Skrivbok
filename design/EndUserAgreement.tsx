import { useNavigate } from 'react-router-dom'

export default function EndUserAgreement() {
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
          <h1>End User License Agreement</h1>
          <p>Last updated: May 12, 2026</p>
        </section>

        <div className="legal-content">
          <h2>1. Agreement to Terms</h2>
          <p>This End User License Agreement ("EULA") is a legal agreement between you ("End User" or "you") and Skrivbok ("Company", "we", or "us") for the use of the Skrivbok platform and all related services, applications, and content ("Software").</p>
          <p>By installing, accessing, or using the Software, you acknowledge that you have read, understood, and agree to be bound by the terms of this EULA. If you do not agree to these terms, do not use the Software.</p>

          <h2>2. License Grant</h2>
          <p>Subject to the terms of this EULA, Skrivbok grants you a limited, non-exclusive, non-transferable, revocable license to:</p>
          <ul>
            <li>Access and use the Software for personal and professional productivity purposes</li>
            <li>Store and manage your data within the Platform</li>
            <li>Use the features available under your subscription tier (Free or PRO)</li>
          </ul>

          <h2>3. License Restrictions</h2>
          <p>You may not:</p>
          <ul>
            <li>Copy, modify, or distribute the Software or any part thereof</li>
            <li>Reverse engineer, decompile, or disassemble the Software</li>
            <li>Rent, lease, lend, sell, or sublicense the Software</li>
            <li>Use the Software to build a competing product or service</li>
            <li>Remove or alter any proprietary notices, labels, or marks on the Software</li>
            <li>Use automated systems (bots, scrapers) to access the Platform</li>
          </ul>

          <h2>4. User Content</h2>
          <h3>4.1 Ownership</h3>
          <p>You retain full ownership of all content, data, documents, and materials you create, upload, or store using the Software ("User Content").</p>
          <h3>4.2 License to Skrivbok</h3>
          <p>By using the Software, you grant Skrivbok a limited, non-exclusive license to host, store, and process your User Content solely for the purpose of providing and improving the service.</p>
          <h3>4.3 Responsibility</h3>
          <p>You are solely responsible for the legality, accuracy, and appropriateness of your User Content. Skrivbok does not endorse or assume liability for any User Content.</p>

          <h2>5. Subscription Tiers</h2>
          <p>Skrivbok offers both free and paid (PRO) tiers. Features and usage limits vary by tier. We reserve the right to modify tier features, pricing, and availability with reasonable notice.</p>

          <h2>6. Updates and Modifications</h2>
          <p>Skrivbok may update, modify, or enhance the Software from time to time. Such updates may be applied automatically. We will make reasonable efforts to ensure backward compatibility, but cannot guarantee that all features will remain unchanged.</p>

          <h2>7. Data Protection</h2>
          <p>We take data protection seriously. Your data is stored securely and processed in accordance with our Privacy Policy. We implement industry-standard security measures to protect your User Content from unauthorized access.</p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. SKRIVBOK DOES NOT WARRANT THAT THE SOFTWARE WILL BE ERROR-FREE OR UNINTERRUPTED.</p>

          <h2>9. Limitation of Liability</h2>
          <p>IN NO EVENT SHALL SKRIVBOK BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES, ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE.</p>

          <h2>10. Termination</h2>
          <p>This EULA is effective until terminated. Your rights under this license will terminate automatically without notice if you fail to comply with any of its terms. Upon termination, you must cease all use of the Software. We will provide a reasonable period for you to export your data before account deletion.</p>

          <h2>11. Governing Law</h2>
          <p>This EULA shall be governed by the laws of India. Any disputes arising from this agreement shall be resolved in the courts of competent jurisdiction in India.</p>

          <h2>12. Contact Information</h2>
          <p>For questions regarding this EULA, please reach out through our Contact Us page.</p>
        </div>

        <footer className="legal-footer">
          <p>© 2026 Skrivbok. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

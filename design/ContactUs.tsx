import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function ContactUs() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 4000)
    setForm({ name: '', email: '', subject: '', message: '' })
  }

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
        .contact-wrapper{max-width:900px;margin:0 auto;padding:40px 40px 100px;display:grid;grid-template-columns:1fr 1fr;gap:48px}
        .contact-info h2{font-family:'Fraunces',serif;font-size:1.8rem;font-weight:400;color:#1a1917;margin-bottom:16px}
        .contact-info>p{color:#7a766f;font-size:0.95rem;line-height:1.8;margin-bottom:32px}
        .contact-item{display:flex;align-items:flex-start;gap:16px;margin-bottom:24px}
        .contact-item-icon{width:44px;height:44px;background:#f4ede7;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#c85c2e;font-size:1.1rem;flex-shrink:0}
        .contact-item h3{font-size:0.95rem;font-weight:600;color:#1a1917;margin-bottom:4px}
        .contact-item p{color:#7a766f;font-size:0.85rem;line-height:1.6}
        .contact-form{background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e4dd}
        .contact-form label{display:block;font-size:0.85rem;font-weight:600;color:#1a1917;margin-bottom:6px}
        .contact-form input,.contact-form textarea,.contact-form select{width:100%;padding:12px 16px;border:1px solid #e8e4dd;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:0.9rem;color:#1a1917;background:#f7f5f0;margin-bottom:20px;transition:border-color 0.2s;outline:none;resize:vertical}
        .contact-form input:focus,.contact-form textarea:focus,.contact-form select:focus{border-color:#c85c2e}
        .contact-form textarea{min-height:120px}
        .contact-submit{width:100%;padding:14px;background:#c85c2e;color:white;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .contact-submit:hover{background:#b0502a;transform:translateY(-1px)}
        .contact-success{background:#d1fae5;color:#065f46;padding:14px;border-radius:10px;text-align:center;font-weight:600;font-size:0.9rem;margin-bottom:16px}
        .legal-footer{background:#1a1917;padding:40px;text-align:center}
        .legal-footer p{color:rgba(255,255,255,0.5);font-size:0.85rem}
        @media(max-width:768px){.contact-wrapper{grid-template-columns:1fr}}
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
          <h1>Contact Us</h1>
          <p>We'd love to hear from you. Reach out with questions, feedback, or just to say hello.</p>
        </section>
        <div className="contact-wrapper">
          <div className="contact-info">
            <h2>Get in Touch</h2>
            <p>Have a question about Skrivbok? Need help with your account? We're here to help and typically respond within 24 hours.</p>
            <div className="contact-item">
              <div className="contact-item-icon"><i className="fas fa-envelope" /></div>
              <div>
                <h3>Email</h3>
                <p>support@skrivbok.com</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-item-icon"><i className="fas fa-clock" /></div>
              <div>
                <h3>Response Time</h3>
                <p>We aim to respond within 24 hours on business days</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-item-icon"><i className="fas fa-shield-halved" /></div>
              <div>
                <h3>Privacy</h3>
                <p>Your information is kept confidential and used only to address your inquiry</p>
              </div>
            </div>
          </div>
          <div className="contact-form">
            {sent && <div className="contact-success"><i className="fas fa-check-circle" /> Message sent successfully! We'll get back to you soon.</div>}
            <form onSubmit={handleSubmit}>
              <label htmlFor="contact-name">Full Name</label>
              <input id="contact-name" type="text" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <label htmlFor="contact-email">Email Address</label>
              <input id="contact-email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              <label htmlFor="contact-subject">Subject</label>
              <select id="contact-subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required>
                <option value="">Select a topic</option>
                <option value="general">General Inquiry</option>
                <option value="support">Technical Support</option>
                <option value="billing">Billing & Refunds</option>
                <option value="feedback">Feedback & Suggestions</option>
                <option value="partnership">Partnership & Collaboration</option>
              </select>
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" placeholder="Tell us how we can help..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required />
              <button type="submit" className="contact-submit">
                <i className="fas fa-paper-plane" /> Send Message
              </button>
            </form>
          </div>
        </div>
        <footer className="legal-footer">
          <p>© 2026 Skrivbok. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

const footerLinks = [
  {
    heading: 'Analenn',
    quote: [
      'Copilul care',
      'a visat',
      'gresit',
    ],
  },
  {
    heading: 'Shop',
    items: [
      { label: 'Capybara', href: '#hero' },
      { label: 'Product Details', href: '#product' },
      { label: 'Features', href: '#features' },
      { label: 'Reviews', href: '#reviews' },
    ],
  },
  {
    heading: 'Help',
    items: [
      { label: 'FAQ', href: '#' },
      { label: 'Terms and Conditions', href: '#' },
      { label: 'Returns', href: '#' },
      { label: 'Contact Us', href: '#' },
    ],
  },
];

const Footer = () => (
  <footer className="w-screen bg-analenn-primary text-[#f4e9ea] py-16 px-6 relative left-1/2 right-1/2 -mx-[50vw] ml-[-50vw] overflow-x-hidden">
    {/* Newsletter Signup */}
    <div className="max-w-3xl mx-auto mb-12">
      <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3">Join the Analenn Family</h2>
      <p className="text-[#f4e9ea] text-center max-w-xl mx-auto mb-6">
        Subscribe to our newsletter for exclusive offers, capybara facts, and new product announcements!
      </p>
      <form className="flex justify-center w-full">
        <div className="flex w-full max-w-xl rounded-md bg-white overflow-hidden shadow-sm">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 px-4 py-3 text-[#7B4A5A] placeholder:text-[#7B4A5A] bg-white border-none focus:outline-none"
          />
          <button
            type="submit"
            className="bg-white text-[#7B4A5A] font-semibold px-6 py-3 transition border-none focus:outline-none hover:bg-[#f2e7e9] hover:text-[#7B4A5A]"
          >
            Subscribe
          </button>
        </div>
      </form>
    </div>

    {/* Footer Links */}
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 text-center">
      {/* Analenn Section with quote */}
      <div>
        <h3 className="font-semibold text-white mb-2">Analenn</h3>
        <blockquote className="text-[#f4e9ea] text-sm italic flex flex-col items-center space-y-0">
          {footerLinks[0].quote.map((line, idx) => (
            <span key={idx}>{line}</span>
          ))}
        </blockquote>
      </div>
      {/* Shop Section */}
      <div>
        <h3 className="font-semibold text-white mb-2">Shop</h3>
        <ul className="space-y-1">
          {footerLinks[1].items.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="text-[#f4e9ea] text-sm hover:underline transition"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Help Section */}
      <div>
        <h3 className="font-semibold text-white mb-2">Help</h3>
        <ul className="space-y-1">
          {footerLinks[2].items.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="text-[#f4e9ea] text-sm hover:underline transition"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>

    {/* Bottom Line */}
    <div className="max-w-5xl mx-auto">
      <div className="border-t border-[#f4e9ea]/20 pt-6 mt-12">
        <p className="text-center text-[#f4e9ea] text-sm">
          © 2025 Analenn. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer; 
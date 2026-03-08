export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-3 gap-8">
        {/* About */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-900">About PolicyBuddies</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            AI-powered insurance Q&amp;A assistant that helps you understand your policies through intelligent conversation.
          </p>
        </div>

        {/* Quick Links */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-900">Quick Links</h3>
          <ul className="space-y-2">
            {["Help Center", "Privacy Policy", "Terms of Service", "Contact Us"].map((link) => (
              <li key={link}>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Information */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-900">Information</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            This is a demo application showing AI-powered policy assistance.
          </p>
          <p className="text-sm text-gray-400">© 2026 PolicyBuddies. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

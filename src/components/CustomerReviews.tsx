import { Star } from 'lucide-react';

const reviews = [
  {
    title: 'Best Gift Ever!',
    text: "I bought this for my daughter's birthday and she absolutely loves it! The quality is amazing and it's so soft.",
    reviewer: 'Sarah T.',
    avatar: 'S',
    role: 'Verified Buyer',
  },
  {
    title: 'Adorable and Well-Made',
    text: "This capybara plush is even cuter in person! The attention to detail is impressive and it's holding up well to daily cuddles.",
    reviewer: 'Michael R.',
    avatar: 'M',
    role: 'Verified Buyer',
  },
  {
    title: 'Fast Shipping, Great Product',
    text: "Arrived earlier than expected and the quality exceeded my expectations. My capybara-obsessed nephew is thrilled!",
    reviewer: 'Jamie L.',
    avatar: 'J',
    role: 'Verified Buyer',
  },
];

function ReviewCard({ title, text, reviewer, avatar, role }: typeof reviews[0]) {
  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-sm flex flex-col gap-4 hover:shadow-md transition">
      {/* 5-star rating */}
      <div className="flex gap-1 text-analenn-primary mb-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-5 h-5 fill-analenn-primary text-analenn-primary" fill="currentColor" />
        ))}
      </div>
      {/* Review title */}
      <div className="font-semibold text-analenn-primary">{title}</div>
      {/* Review text */}
      <div className="text-gray-700 text-sm leading-relaxed">{text}</div>
      {/* Reviewer info */}
      <div className="flex items-center gap-3 mt-2">
        <span className="w-10 h-10 rounded-full bg-[#f0eaea] flex items-center justify-center font-bold text-analenn-primary text-lg">
          {avatar}
        </span>
        <div className="flex flex-col items-start">
          <span className="font-bold text-analenn-primary">{reviewer}</span>
          <span className="text-xs text-gray-400">{role}</span>
        </div>
      </div>
    </div>
  );
}

const CustomerReviews = () => (
  <section id="reviews" className="bg-white py-16 px-6">
    <h2 className="text-3xl font-bold text-analenn-primary text-center mb-12">Customer Reviews</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {reviews.map((review, idx) => (
        <ReviewCard key={idx} {...review} />
      ))}
    </div>
  </section>
);

export default CustomerReviews; 
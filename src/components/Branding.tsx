import { CheckCircle, Lock, Scale } from 'lucide-react';

// Branding section highlighting brand values
const Branding = () => (
  <div id="features" className="relative bg-[#f8f8f8]">
    <div className="max-w-7xl mx-auto py-16 px-6">
      <section>
        {/* Section Title */}
        <h2 className="text-3xl font-extrabold text-analenn-primary text-center mb-12">
          Why Choose Analenn?
        </h2>
        {/* Responsive flex layout for feature cards */}
        <div className="flex flex-col md:flex-row justify-center gap-4">
          {/* Premium Quality Card */}
          <div className="bg-white shadow-md rounded-xl p-6 md:p-8 text-center max-w-xs flex flex-col items-center">
            {/* Icon in a soft circle */}
            <span className="bg-gray-100 rounded-full p-4 mb-4 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-analenn-primary" />
            </span>
            <h3 className="text-lg font-semibold text-analenn-primary mb-2">Premium Quality</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Made with the softest eco-friendly materials for maximum cuddliness and durability.
            </p>
          </div>
          {/* Child Safe Card */}
          <div className="bg-white shadow-md rounded-xl p-6 md:p-8 text-center max-w-xs flex flex-col items-center">
            <span className="bg-gray-100 rounded-full p-4 mb-4 flex items-center justify-center">
              <Lock className="w-8 h-8 text-analenn-primary" />
            </span>
            <h3 className="text-lg font-semibold text-analenn-primary mb-2">Child Safe</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Hypoallergenic filling and secure stitching make Cappy safe for all ages.
            </p>
          </div>
          {/* Ethically Made Card */}
          <div className="bg-white shadow-md rounded-xl p-6 md:p-8 text-center max-w-xs flex flex-col items-center">
            <span className="bg-gray-100 rounded-full p-4 mb-4 flex items-center justify-center">
              <Scale className="w-8 h-8 text-analenn-primary" />
            </span>
            <h3 className="text-lg font-semibold text-analenn-primary mb-2">Ethically Made</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Produced in fair-trade certified facilities with sustainable practices.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
);

export default Branding; 
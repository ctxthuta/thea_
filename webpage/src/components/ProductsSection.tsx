'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { productCategories, allProducts, type ProductCategory } from '@/lib/productData';
import { CustomArrowRight, CustomChevronDown, CustomSparkles } from '@/components/icons/CustomIcons';
import mixpanel from 'mixpanel-browser';

export default function ProductsSection() {
  const [expandedCategory, setExpandedCategory] = useState<ProductCategory | null>(null);

  const toggleCategory = (category: ProductCategory) => {
    const newExpanded = expandedCategory === category ? null : category;
    setExpandedCategory(newExpanded);
    
    try {
      mixpanel.track('Product Category Expanded', {
        category: category,
        category_name: productCategories[category].name,
        expanded: newExpanded !== null,
      });
    } catch (error) {
      console.error('Mixpanel tracking error:', error);
    }
  };

  const handleDemoClick = (product: any) => {
    try {
      mixpanel.track('Demo Request Clicked', {
        product_id: product.id,
        product_name: product.name,
        product_category: product.category,
      });
    } catch (error) {
      console.error('Mixpanel tracking error:', error);
    }
  };

  return (
    <section className="py-20 sm:py-28 bg-[#1A1816] text-[#F1F1F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-3">
            <CustomSparkles size={13} className="text-[#e36a88]" />
            <span>Autonomous Enterprise Suite · AI Agents</span>
          </div>
          <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Thea Corporate Agents
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
            Pre-engineered AI agents and specialized systems built to automate workflows across finance, operations, customer support, and sales.
          </p>
        </div>

        {/* Categories Stack in TanStack DS Style */}
        <div className="space-y-4">
          {Object.entries(productCategories).map(([key, category]) => {
            const categoryKey = key as ProductCategory;
            const isExpanded = expandedCategory === categoryKey;
            const categoryProducts = allProducts.filter(p => p.category === categoryKey);

            return (
              <div 
                key={categoryKey} 
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded 
                    ? 'border-[#5F1F2F]/70 bg-[#181816]/95 shadow-[0_8px_32px_-4px_rgba(95,31,47,0.25)]' 
                    : 'border-white/10 bg-[#181816]/60 hover:border-white/20 hover:bg-[#181816]/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(categoryKey)}
                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-ds-mono text-[11px] uppercase tracking-wider text-[#f3a6b7] block mb-1">
                      Department Module
                    </span>
                    <h3 className="font-ds-display text-xl sm:text-2xl font-bold text-white">
                      {category.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 font-light mt-1">
                      {category.description}
                    </p>
                  </div>
                  
                  <div className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all ${
                    isExpanded 
                      ? 'border-[#5F1F2F] bg-[#5F1F2F]/30 text-white rotate-180' 
                      : 'border-white/10 bg-white/[0.04] text-gray-400'
                  }`}>
                    <CustomChevronDown size={18} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-white/[0.06] space-y-4">
                    {categoryProducts.map((product) => (
                      <div 
                        key={product.id} 
                        className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-[#5F1F2F]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-ds-display text-lg font-bold text-white">
                            {product.name}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-400 font-light mt-1 max-w-2xl leading-relaxed">
                            {product.description}
                          </p>
                          {product.features && product.features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {product.features.slice(0, 3).map((feature, index) => (
                                <span 
                                  key={index} 
                                  className="font-ds-mono text-[11px] rounded-md bg-white/[0.04] text-gray-300 border border-white/10 px-2 py-0.5"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/schedule-demo?product=${product.id}`}
                          onClick={() => handleDemoClick(product)}
                          className="inline-flex items-center gap-1.5 rounded-full py-2 px-4 text-xs font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white transition-all shrink-0 self-start sm:self-center shadow-sm"
                        >
                          <span>Request Demo</span>
                          <CustomArrowRight size={13} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
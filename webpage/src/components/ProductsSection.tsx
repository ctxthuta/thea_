'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { productCategories, allProducts, type ProductCategory } from '@/lib/productData';
import { ArrowRight, ChevronDown } from 'lucide-react';
import mixpanel from 'mixpanel-browser';

export default function ProductsSection() {
  const [expandedCategory, setExpandedCategory] = useState<ProductCategory | null>(null);

  const toggleCategory = (category: ProductCategory) => {
    const newExpanded = expandedCategory === category ? null : category;
    setExpandedCategory(newExpanded);
    
    // Track category expansion
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

  const handleDemoClick = (product: any, event: React.MouseEvent) => {
    // Track demo request click
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
    <section className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <span className="text-sm paragraph-color opacity-40">Our Products</span>
          <h2 className="text-3xl md:text-4xl font-bold paragraph-color mt-2 mb-4">
            Thea Corporate Agents
          </h2>
          <p className="paragraph-color opacity-70 max-w-2xl">
            AI-powered solutions designed to transform your enterprise operations across every department.
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(productCategories).map(([key, category]) => {
            const categoryKey = key as ProductCategory;
            const isExpanded = expandedCategory === categoryKey;
            const categoryProducts = allProducts.filter(p => p.category === categoryKey);

            return (
              <div key={categoryKey} className="border-b border-color border-opacity-20 pb-6">
                <button
                  onClick={() => toggleCategory(categoryKey)}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <div>
                    <h3 className="text-xl paragraph-color font-medium">{category.name}</h3>
                    <p className="text-sm paragraph-color opacity-60 mt-1">{category.description}</p>
                  </div>
                  <ChevronDown 
                    className={`paragraph-color opacity-60 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    size={20}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-6 space-y-4">
                    {categoryProducts.map((product) => (
                      <div key={product.id} className="pl-4 border-l-2 border-[#5F1F2F]">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="paragraph-color font-medium">{product.name}</h4>
                            <p className="text-sm paragraph-color opacity-60 mt-1">
                              {product.description}
                            </p>
                          </div>
                          <Link
                            href={`/schedule-demo?product=${product.id}`}
                            onClick={(e) => handleDemoClick(product, e)}
                            className="flex items-center gap-2 text-sm accent-color hover:opacity-80 transition-opacity ml-4"
                          >
                            Request Demo
                            <ArrowRight size={16} />
                          </Link>
                        </div>
                        {product.features && product.features.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {product.features.slice(0, 3).map((feature, index) => (
                              <span key={index} className="text-xs paragraph-color opacity-50">
                                {feature}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-12 pt-8 border-t border-color border-opacity-20">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl paragraph-color font-medium mb-2">
                Ready to transform your operations?
              </h3>
              <p className="text-sm paragraph-color opacity-60">
                Schedule a personalized demo to see how Thea solutions can benefit your organization.
              </p>
            </div>
            <Link
              href="/schedule-demo"
              className="px-6 py-3 bg-[#5F1F2F] text-white rounded-lg hover:bg-[#8B2F4F] transition-colors flex items-center gap-2"
            >
              Schedule Demo
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { ShowcaseProduct, AppView } from '../types';
import { mediaStorageService } from '../services/cloudinaryService';
import { AppUser, isAdminUser } from '../services/firebase';

interface SellerAnalyticsProps {
  currentUser?: AppUser | null;
  onNotify: (msg: string) => void;
  go: (view: AppView | string) => void;
}

export const SellerAnalytics: React.FC<SellerAnalyticsProps> = ({
  currentUser,
  onNotify,
  go,
}) => {
  const [products, setProducts] = useState<ShowcaseProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    const data = await mediaStorageService.getShowcaseProducts();
    if (currentUser && !isAdminUser(currentUser)) {
      setProducts(
        data.filter(
          (p) => p.userId === currentUser.uid || p.artisanName?.toLowerCase() === (currentUser.displayName || '').toLowerCase()
        )
      );
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, [currentUser]);

  const handleDelete = async (id: string) => {
    await mediaStorageService.deleteShowcaseProduct(id);
    setConfirmDeleteId(null);
    onNotify('Product removed successfully.');
    loadProducts();
  };

  const totalViews = products.reduce((acc, p) => acc + (p.viewsCount || 15), 0);
  const totalProducts = products.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Summary Header */}
      <div className="bg-[#17365D] text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F4B966]">
            <Icon name="trending" size={14} />
            <span>Seller &amp; Artisan Analytics Portal</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
            विक्रेता एवं उत्पाद विश्लेषण (Seller Analytics)
          </h1>
          <p className="text-xs sm:text-sm text-white/80 max-w-xl">
            {isAdminUser(currentUser)
              ? 'Super Admin View: Cumulative performance across all registered artisan and SHG products.'
              : `Viewing analytics for ${currentUser?.displayName || 'Registered Artisan'}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => go('business-upload')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#287D73] hover:bg-[#1E6058] text-white font-extrabold text-xs sm:text-sm transition-colors flex items-center gap-2"
          >
            <Icon name="plus" size={16} />
            <span>Add New Product</span>
          </button>
          <button
            onClick={() => go('home')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-colors"
          >
            View Showcase
          </button>
        </div>
      </div>

      {/* Cumulative Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-5 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
            Total Active Products
          </span>
          <div className="text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque'] tabular-nums">
            {totalProducts}
          </div>
          <div className="text-xs text-[#287D73] font-semibold">Live in Rural Showcase</div>
        </div>

        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-5 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
            Cumulative Views Count
          </span>
          <div className="text-3xl font-extrabold text-[#245A91] font-['Bricolage_Grotesque'] tabular-nums">
            {totalViews}
          </div>
          <div className="text-xs text-[#5F6B76] font-medium">Customer engagement views</div>
        </div>

        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-5 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B76]">
            Average Views per Product
          </span>
          <div className="text-3xl font-extrabold text-[#287D73] font-['Bricolage_Grotesque'] tabular-nums">
            {totalProducts > 0 ? Math.round(totalViews / totalProducts) : 0}
          </div>
          <div className="text-xs text-[#5F6B76] font-medium">High rural market reach</div>
        </div>
      </div>

      {/* Active Products List */}
      <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EA]">
          <h3 className="font-extrabold text-base text-[#17365D] tabular-nums">
            Active Products &amp; Performance Breakdown ({products.length})
          </h3>
          <button
            onClick={loadProducts}
            className="min-h-[36px] text-xs font-bold text-[#245A91] hover:underline flex items-center gap-1.5"
          >
            <Icon name="refresh" size={13} />
            <span>Refresh Analytics</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#5F6B76]">
            No active products found. Click "Add New Product" to publish your first item!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div className="h-44 relative bg-slate-200">
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#17365D]/85 text-white">
                    {p.category}
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#17365D] text-white tabular-nums inline-flex items-center gap-1">
                    <Icon name="eye" size={12} />
                    <span>{p.viewsCount || 15} views</span>
                  </span>
                </div>

                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#17365D] line-clamp-1">{p.title}</h4>
                    <p className="text-xs text-[#5F6B76] line-clamp-2 mt-0.5">{p.description}</p>
                  </div>
                  <div className="pt-3 border-t border-[#DCE3EA] flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-[#17365D] truncate">{p.artisanName}</div>
                      <div className="text-[11px] text-[#5F6B76] truncate">{p.location}</div>
                    </div>
                    {confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#9E2A2B] text-white font-bold text-xs"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg border border-[#DCE3EA] bg-white text-[#5F6B76] font-bold text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#9E2A2B] font-bold text-xs transition-colors flex-shrink-0"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

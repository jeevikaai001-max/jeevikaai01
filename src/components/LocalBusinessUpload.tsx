import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { AppView, ShowcaseProduct } from '../types';
import { mediaStorageService, uploadToCloudinary } from '../services/cloudinaryService';
import { AppUser } from '../services/firebase';

interface LocalBusinessUploadProps {
  onNotify: (msg: string) => void;
  go: (view: AppView | string) => void;
  currentUser?: AppUser | null;
  onOpenAccount?: (mode: 'create' | 'login') => void;
  onOpenGoogleLogin?: () => void;
  userName?: string;
  userPhone?: string;
  userLocation?: string;
  onClose?: () => void;
}

export const LocalBusinessUpload: React.FC<LocalBusinessUploadProps> = ({
  onNotify,
  go,
  currentUser,
  onOpenGoogleLogin,
  userName = '',
  userPhone = '',
  userLocation = '',
  onClose,
}) => {
  const isLogged = Boolean(currentUser && !currentUser.isAnonymous);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('हस्तशिल्प व कपड़े');
  const [artisanName, setArtisanName] = useState(currentUser?.displayName || userName || '');
  const [location, setLocation] = useState(userLocation || 'महाराजगंज, उत्तर प्रदेश');
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || userPhone || '');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [myProducts, setMyProducts] = useState<ShowcaseProduct[]>([]);
  const [loadingMyProducts, setLoadingMyProducts] = useState<boolean>(false);

  const loadMyProducts = async () => {
    if (!currentUser) return;
    setLoadingMyProducts(true);
    const all = await mediaStorageService.getShowcaseProducts();
    const mine = all.filter(
      (p) => p.userId === currentUser.uid || p.artisanName?.toLowerCase() === (currentUser.displayName || '').toLowerCase()
    );
    setMyProducts(mine);
    setLoadingMyProducts(false);
  };

  useEffect(() => {
    if (isLogged) {
      loadMyProducts();
    }
  }, [isLogged, currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogged) {
      onNotify('उत्पाद प्रकाशित करने के लिए कृपया पहले लॉगिन करें।');
      return;
    }
    if (!title.trim() || !artisanName.trim()) {
      onNotify('कृपया उत्पाद का नाम और कारीगर/विक्रेता का नाम दर्ज करें।');
      return;
    }

    setUploading(true);
    setUploadProgress(20);
    try {
      let finalImageUrl = '/src/assets/images/trade_tailoring_1795513566462.jpg';

      if (imageFile) {
        finalImageUrl = await uploadToCloudinary(imageFile, 'showcase', (pct) => {
          setUploadProgress(Math.max(20, pct));
        });
      }

      const nowIso = new Date().toISOString();
      await mediaStorageService.addShowcaseProduct({
        title: title.trim(),
        description: description.trim(),
        imageUrl: finalImageUrl,
        price: price.trim() || 'कीमत संपर्क पर',
        category,
        artisanName: artisanName.trim(),
        location: location.trim() || 'भारत',
        contactPhone: contactPhone.trim(),
        createdAt: nowIso,
        userId: currentUser?.uid,
        viewsCount: 1,
      });

      onNotify('आपका उत्पाद ' + title.trim() + ' सफलतापूर्वक ग्रामीण उत्पाद प्रदर्शनी में प्रकाशित कर दिया गया है!');
      setUploadSuccess(true);
      setTitle('');
      setDescription('');
      setPrice('');
      setImageFile(null);
      setPreviewUrl('');
      loadMyProducts();
      setTimeout(() => setUploadSuccess(false), 2500);
    } catch (err: any) {
      onNotify('उत्पाद अपलोड विफल: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    await mediaStorageService.deleteShowcaseProduct(id);
    setConfirmDeleteId(null);
    onNotify('उत्पाद सफलतापूर्वक हटा दिया गया है।');
    loadMyProducts();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl border border-[#DCE3EA] p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#DCE3EA]">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#287D73] mb-1">
              <Icon name="store" size={14} />
              <span>Seller Portal · स्थानीय विक्रेता व कारीगर पोर्टल</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
              + अपना उत्पाद जोड़ें &amp; डैशबोर्ड (Local Business Upload)
            </h2>
            <p className="text-xs text-[#5F6B76] mt-0.5">
              ग्रामीण हुनरमंद, स्वयं सहायता समूह एवं महिला उद्यमी अपने उत्पादों की तस्वीरें अपलोड करें और व्यूज़ देखें।
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="बंद करें"
              className="w-10 h-10 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#5F6B76] hover:text-[#17365D] flex items-center justify-center font-bold text-sm flex-shrink-0"
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>

        {/* Login Gate */}
        {!isLogged ? (
          <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[#17365D] text-white mx-auto flex items-center justify-center">
              <Icon name="lock" size={28} />
            </div>
            <div className="space-y-1.5">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[#FFF8EB] text-[#B45309] border border-[#FDE68A]">
                Authentication Required · लॉगिन आवश्यक
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#17365D]">
                उत्पाद अपलोड करने के लिए पहले गूगल से लॉगिन करें
              </h3>
              <p className="text-xs sm:text-sm text-[#5F6B76] max-w-md mx-auto">
                अपने स्थानीय हस्तशिल्प, अचार, सिलाई या अन्य ग्रामीण उत्पाद अपलोड करने और लाइव आंकड़ों में प्रदर्शित करने के लिए प्रमाणित गूगल खाते से साइन इन करें।
              </p>
            </div>
            <div>
              {onOpenGoogleLogin && (
                <button
                  type="button"
                  onClick={onOpenGoogleLogin}
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 mx-auto transition-colors"
                >
                  <Icon name="user" size={18} />
                  <span>Google से लॉगिन करें (Google Sign-In)</span>
                </button>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => (onClose ? onClose() : go('home'))}
                className="text-xs font-bold text-[#5F6B76] hover:text-[#17365D] underline"
              >
                ← मुख्य पृष्ठ पर लौटें (Return Home)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Logged in summary banner */}
            <div className="bg-[#E9F4F2] border border-[#287D73]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#287D73] text-white flex items-center justify-center font-bold flex-shrink-0">
                  <Icon name="check" size={20} />
                </div>
                <div>
                  <div className="font-extrabold text-[#17365D] text-sm">
                    {currentUser?.displayName || currentUser?.email || 'Seller'}
                  </div>
                  <div className="text-xs text-[#287D73] font-semibold tabular-nums">
                    प्रमाणित विक्रेता पोर्टल · कुल प्रकाशित उत्पाद: <strong>{myProducts.length}</strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => go('home')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white border border-[#DCE3EA] text-[#17365D] font-bold hover:border-[#245A91] transition-colors"
              >
                बाज़ार (Showcase) देखें →
              </button>
            </div>

            {/* Upload Form */}
            <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl p-6 space-y-4">
              <h3 className="font-extrabold text-base text-[#17365D] flex items-center gap-2">
                <Icon name="plus" size={18} className="text-[#287D73]" />
                <span>नया उत्पाद दर्ज करें (Publish New Item)</span>
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#17365D] mb-1.5">
                    उत्पाद की तस्वीर (Product Image) *
                  </label>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-dashed border-[#DCE3EA]">
                    {previewUrl ? (
                      <div className="w-24 h-24 rounded-xl overflow-hidden border border-[#DCE3EA] flex-shrink-0">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] flex items-center justify-center text-[#5F6B76] flex-shrink-0">
                        <Icon name="camera" size={28} />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#17365D] file:text-white hover:file:bg-[#245A91] cursor-pointer"
                      />
                      <p className="text-[11px] text-[#5F6B76] mt-1.5">
                        क्लाउड स्टोरेज पर सुरक्षित रूप से संपीड़ित व संग्रहीत।
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#17365D] mb-1">उत्पाद का नाम / शीर्षक *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="उदा. हस्तनिर्मित कढ़ाई कुर्ती, जैविक अचार, टेराकोटा दीये"
                    required
                    className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-semibold text-sm bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#17365D] mb-1">कीमत (Price)</label>
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="उदा. ₹ 450"
                      className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-semibold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#17365D] mb-1">श्रेणी (Category)</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-semibold bg-white"
                    >
                      <option value="हस्तशिल्प व कपड़े">हस्तशिल्प व कपड़े (Handicrafts &amp; Apparel)</option>
                      <option value="खाद्य प्रसंस्करण">खाद्य प्रसंस्करण (Food &amp; Pickles)</option>
                      <option value="मिट्टी शिल्प">मिट्टी शिल्प व टेराकोटा (Pottery)</option>
                      <option value="घरेलू व अन्य">घरेलू व अन्य उत्पाद (Home &amp; Others)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#17365D] mb-1">कारीगर / SHG का नाम *</label>
                    <input
                      type="text"
                      value={artisanName}
                      onChange={(e) => setArtisanName(e.target.value)}
                      placeholder="उदा. सुनीता देवी (उजाला SHG)"
                      required
                      className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-semibold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#17365D] mb-1">मोबाइल नंबर (संपर्क हेतु)</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="98391XXXXX"
                      className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-semibold bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#17365D] mb-1">स्थान (गाँव / ज़िला, राज्य)</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="उदा. महाराजगंज, उत्तर प्रदेश"
                    className="w-full min-h-[44px] p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-semibold bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#17365D] mb-1">उत्पाद विवरण (Description)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="सामग्री, निर्माण विधि और विशेषता के बारे में लिखें..."
                    className="w-full p-3 rounded-xl border border-[#DCE3EA] text-[#17365D] font-medium resize-none bg-white"
                  />
                </div>

                {uploading && (
                  <div className="space-y-1.5 p-3 bg-[#287D73]/10 rounded-xl border border-[#287D73]/30">
                    <div className="flex justify-between text-xs font-bold text-[#287D73] tabular-nums">
                      <span>Cloudinary पर अपलोड हो रहा है...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#287D73] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={uploading}
                    className={`min-h-[48px] px-8 py-3 rounded-xl font-extrabold transition-colors disabled:opacity-50 flex items-center gap-2 ${
                      uploadSuccess
                        ? 'bg-[#1E6058] text-white'
                        : 'bg-[#287D73] hover:bg-[#1E6058] text-white'
                    }`}
                  >
                    {uploadSuccess ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="check" size={18} />
                        <span>उत्पाद सफलतापूर्वक प्रकाशित हो गया!</span>
                      </span>
                    ) : uploading ? (
                      <span>प्रकाशित हो रहा है...</span>
                    ) : (
                      <span>उत्पाद प्रकाशित करें (Publish Item)</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* My Uploaded Products & Analytics */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-[#17365D]">
                    आपके द्वारा जोड़े गए उत्पाद व आंकड़े (My Uploads &amp; Analytics)
                  </h3>
                  <p className="text-xs text-[#5F6B76]">
                    तारीख, समय और लाइव व्यूज़ काउंट (Views Count) की जानकारी।
                  </p>
                </div>
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D] tabular-nums">
                  Total: {myProducts.length} items
                </span>
              </div>

              {loadingMyProducts ? (
                <div className="h-28 rounded-2xl bg-[#F7F9FC] border border-[#DCE3EA] flex items-center justify-center text-xs text-[#5F6B76]">
                  डेटा लोड हो रहा है...
                </div>
              ) : myProducts.length === 0 ? (
                <div className="p-8 bg-[#F7F9FC] border border-[#DCE3EA] rounded-2xl text-center text-xs text-[#5F6B76]">
                  आपने अभी तक कोई उत्पाद नहीं जोड़ा है। ऊपर दिए गए फॉर्म से अपना पहला उत्पाद जोड़ें!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myProducts.map((p) => {
                    const dateFormatted = p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString('hi-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'हाल ही में';
                    return (
                      <div
                        key={p.id}
                        className="bg-white border border-[#DCE3EA] rounded-2xl p-4 flex gap-4 items-center"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F7F9FC] border border-[#DCE3EA] flex-shrink-0 relative">
                          <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#17365D]/90 text-white tabular-nums">
                            {p.viewsCount || 12} views
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F7F9FC] border border-[#DCE3EA] text-[#17365D]">
                              {p.category}
                            </span>
                            <span className="text-xs font-extrabold text-[#287D73] tabular-nums">{p.price}</span>
                          </div>
                          <h4 className="font-extrabold text-sm text-[#17365D] truncate">{p.title}</h4>
                          <div className="text-[11px] text-[#5F6B76] flex items-center justify-between pt-1.5 border-t border-[#DCE3EA]">
                            <span className="tabular-nums">{dateFormatted}</span>
                            {confirmDeleteId === p.id ? (
                              <span className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="text-[#9E2A2B] font-extrabold hover:underline"
                                >
                                  पुष्टि करें
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[#5F6B76] font-bold hover:underline"
                                >
                                  रद्द
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(p.id)}
                                className="text-[#9E2A2B] font-bold hover:underline"
                              >
                                हटाएं
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useRef, useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Icon } from './Icons';
import { SummaryModalData, SupportedLanguage } from '../types';
import { STAGE_TITLES } from '../data/mockData';

interface SummaryModalProps {
  data: SummaryModalData;
  onClose: () => void;
  onNotify: (msg: string) => void;
  currentLang?: SupportedLanguage;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  data,
  onClose,
  onNotify,
  currentLang = 'hi',
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const profile = data.profile;
  const pathway = data.selectedPathway;
  const jobs = data.jobs?.slice(0, 3) || [];
  const displayName = profile?.name?.trim() || 'लाभार्थी (Beneficiary)';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const docRefId = useMemo(
    () => `JK-${(profile?.name || 'BEN').slice(0, 3).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    [profile?.name]
  );

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    onNotify(
      currentLang === 'bho'
        ? 'पीडीएफ तैयार हो रहल बा, कृपया थोड़ा इंतजार करीं...'
        : 'पीडीएफ तैयार हो रहा है, कृपया प्रतीक्षा करें...'
    );

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      if (printRef.current) {
        try {
          const canvas = await html2canvas(printRef.current, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800,
          });

          const imgData = canvas.toDataURL('image/png');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const margin = 8;
          const contentWidth = pdfWidth - margin * 2;
          const contentHeight = (canvas.height * contentWidth) / canvas.width;

          let heightLeft = contentHeight;
          let position = margin;

          pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
          heightLeft -= pdfHeight - margin * 2;

          while (heightLeft > 0) {
            position = heightLeft - contentHeight + margin;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
            heightLeft -= pdfHeight - margin * 2;
          }
        } catch (canvasErr) {
          console.warn('html2canvas fallback triggered:', canvasErr);
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.text('JEEVIKAAI LIVELIHOOD ROADMAP', 15, 20);
          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.text(`Beneficiary: ${displayName}`, 15, 30);
          pdf.text(`Date: ${dateStr}`, 15, 36);

          const splitText = pdf.splitTextToSize(data.text, 180);
          pdf.text(splitText, 15, 45);
        }
      } else {
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text('JEEVIKAAI LIVELIHOOD ROADMAP', 15, 20);
        const splitText = pdf.splitTextToSize(data.text, 180);
        pdf.text(splitText, 15, 35);
      }

      const pdfBaseName = (data.fname || 'JeevikaAI-Roadmap').replace(/\.txt$/i, '');
      const finalPdfName = `${pdfBaseName}.pdf`;
      pdf.save(finalPdfName);

      onNotify(
        currentLang === 'bho'
          ? `पीडीएफ डाउनलोड हो गइल: ${finalPdfName}`
          : `पीडीएफ सफलतापूर्वक डाउनलोड हुआ: ${finalPdfName}`
      );
    } catch (err) {
      console.error('PDF generation error:', err);
      onNotify('पीडीएफ डाउनलोड करने में समस्या आई। कृपया टेक्स्ट फाइल या प्रिंट विकल्प का उपयोग करें।');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTextFile = () => {
    try {
      const blob = new Blob([data.text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.fname || 'JeevikaAI-summary.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify(`Summary saved as ${data.fname}`);
    } catch {
      onNotify('Direct file save not supported; copying text instead.');
      handleCopyText();
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(data.text);
      onNotify('Summary copied to clipboard!');
    } catch {
      if (preRef.current) {
        const range = document.createRange();
        range.selectNodeContents(preRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        onNotify('Summary selected. Please press Copy on your device.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B1B30]/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-[#202B36] border border-[#DCE3EA] rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Livelihood Roadmap Summary and PDF"
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-[#DCE3EA] bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#17365D] text-white flex items-center justify-center">
              <Icon name="download" size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-[#17365D]">
                आजीविका रोडमैप एक्सपोर्ट (Livelihood Roadmap)
              </h2>
              <p className="text-[11px] text-[#5F6B76]">
                ऑफलाइन उपयोग और प्रिंटिंग हेतु पीडीएफ व टेक्स्ट डाउनलोड करें
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] text-[#5F6B76] hover:text-[#17365D] flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-[#F7F9FC] border-b border-[#DCE3EA] flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'pdf'
                ? 'bg-[#17365D] text-white'
                : 'bg-white border border-[#DCE3EA] text-[#5F6B76] hover:text-[#17365D]'
            }`}
          >
            <Icon name="download" size={14} />
            <span>प्रिंटेबल रोडमैप (PDF / Print View)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'text'
                ? 'bg-[#17365D] text-white'
                : 'bg-white border border-[#DCE3EA] text-[#5F6B76] hover:text-[#17365D]'
            }`}
          >
            <span>सादा टेक्स्ट (.txt Summary)</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#F7F9FC]">
          {activeTab === 'pdf' ? (
            <div className="flex justify-center">
              <div
                ref={printRef}
                className="w-full max-w-[760px] bg-white text-[#17365D] p-6 sm:p-8 rounded-2xl border border-[#DCE3EA] space-y-6 font-['Hind'] leading-normal print:border-none print:p-0"
                style={{ minHeight: '880px' }}
              >
                <div className="flex h-2 w-full rounded-t-lg overflow-hidden -mt-2 -mx-2 mb-4">
                  <div className="flex-1 bg-[#FF9933]" />
                  <div className="flex-1 bg-white border-y border-slate-200" />
                  <div className="flex-1 bg-[#138808]" />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#17365D]/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#17365D] text-white text-[10px] font-extrabold uppercase tracking-wider">
                        JeevikaAI · जीविका एआई
                      </span>
                      <span className="text-[10px] font-bold text-[#287D73] bg-[#287D73]/10 px-2 py-0.5 rounded">
                        NSQF संरेखित आजीविका दस्तावेज
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#17365D] tracking-tight font-['Bricolage_Grotesque']">
                      व्यक्तिगत आजीविका व कौशल रोडमैप
                    </h1>
                    <p className="text-xs text-[#5F6B76]">
                      Personalized Vocational Learning, Skilling &amp; Livelihood Action Plan
                    </p>
                  </div>

                  <div className="text-right bg-[#F7F9FC] p-2.5 rounded-xl border border-[#DCE3EA] text-xs space-y-0.5 flex-shrink-0">
                    <div className="text-[10px] text-[#5F6B76]">Ref No / संदर्भ संख्या:</div>
                    <div className="font-extrabold text-[#17365D] font-mono tabular-nums text-[11px]">{docRefId}</div>
                    <div className="text-[10px] text-[#5F6B76]">जारी तिथि: {dateStr}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5F6B76] flex items-center gap-1.5">
                    <Icon name="user" size={13} className="text-[#245A91]" />
                    <span>लाभार्थी विवरण (Beneficiary Profile)</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#F7F9FC] p-3.5 rounded-xl border border-[#DCE3EA] text-xs">
                    <div>
                      <span className="text-[10px] text-[#5F6B76] block">नाम (Name)</span>
                      <strong className="text-[#17365D] text-sm">{displayName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5F6B76] block">जिला (District / State)</span>
                      <strong className="text-[#17365D]">{profile?.location || 'उपलब्ध नहीं'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5F6B76] block">शिक्षा स्तर (Education)</span>
                      <strong className="text-[#17365D]">{profile?.education || '10वीं / 12वीं'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5F6B76] block">कार्य प्राथमिकता (Work Type)</span>
                      <strong className="text-[#17365D]">{profile?.workType || 'Job & Self-employment'}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-[#5F6B76] block">हुनर / कौशल (Existing Skills)</span>
                      <span className="font-medium text-[#202B36]">{profile?.skills || 'बुनियादी कौशल'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-[#5F6B76] block">पसंदीदा कार्य / रुचि (Interests)</span>
                      <span className="font-medium text-[#202B36]">{profile?.interests || 'रोजगार व आत्मनिर्भरता'}</span>
                    </div>
                  </div>

                  {profile?.aiAnalysis?.summary && (
                    <div className="p-3 bg-[#E3F1FA]/60 border border-[#245A91]/25 rounded-xl text-xs flex items-start gap-2 text-[#17365D]">
                      <Icon name="sparkles" size={14} className="text-[#245A91] mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="font-bold">AI विश्लेषण सारांश: </strong>
                        <span>{profile.aiAnalysis.summary}</span>
                        {profile.aiAnalysis.readinessScore && (
                          <span className="ml-2 font-bold bg-white border border-[#DCE3EA] px-2 py-0.5 rounded text-[10px] tabular-nums">
                            तैयारी स्कोर: {profile.aiAnalysis.readinessScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {pathway && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5F6B76] flex items-center gap-1.5">
                      <Icon name="route" size={13} className="text-[#287D73]" />
                      <span>अनुशंसित कौशल व प्रशिक्षण मार्ग (Recommended NSQF Pathway)</span>
                    </h3>

                    <div className="p-4 bg-[#287D73]/5 border border-[#287D73]/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#287D73] text-white text-[10px] font-bold">
                          ★ प्राथमिकता संस्तुति
                        </div>
                        <h4 className="text-base sm:text-lg font-extrabold text-[#17365D] mt-1">
                          {pathway.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5F6B76] mt-0.5">
                          <span>भूमिका: <strong className="text-[#17365D]">{pathway.role}</strong></span>
                          <span>•</span>
                          <span>अवधि: <strong className="text-[#17365D]">{pathway.duration}</strong></span>
                          <span>•</span>
                          <span>प्रमाणन स्तर: <strong className="text-[#17365D] tabular-nums">NSQF Level {pathway.nsqf}</strong></span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-[#DCE3EA] text-center flex-shrink-0">
                        <div className="text-[10px] text-[#5F6B76] uppercase font-bold">मैच स्कोर</div>
                        <div className="text-2xl font-black text-[#287D73] tabular-nums">
                          {'score' in pathway ? pathway.score : 88}%
                        </div>
                        <div className="text-[10px] text-[#1E6058] font-bold">उच्च अनुकूलता</div>
                      </div>
                    </div>
                  </div>
                )}

                {pathway?.stages && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5F6B76] flex items-center gap-1.5">
                      <Icon name="check" size={13} className="text-[#245A91]" />
                      <span>3-चरणीय प्रगति योजना (Step-by-Step Learning Stages)</span>
                    </h3>

                    <div className="space-y-2 text-xs">
                      {pathway.stages.map((stage: [string, string, string], idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#DCE3EA]"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#17365D] text-white flex items-center justify-center font-extrabold text-xs flex-shrink-0 tabular-nums">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-[#17365D] text-xs">
                                {STAGE_TITLES[idx] || `चरण ${idx + 1}`}: {stage[0]}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#F7F9FC] border border-[#DCE3EA] text-[#5F6B76] text-[10px] font-bold tabular-nums">
                                {stage[2] || '4-6 सप्ताह'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5F6B76] mt-0.5 leading-relaxed">
                              {stage[1]}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {jobs.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5F6B76] flex items-center gap-1.5">
                      <Icon name="briefcase" size={13} className="text-[#245A91]" />
                      <span>नजदीकी रोजगार व प्रशिक्षण के अवसर (Sample Local Opportunities)</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {jobs.map((job, i) => (
                        <div key={job.id || i} className="p-2.5 rounded-xl bg-[#F7F9FC] border border-[#DCE3EA] space-y-1">
                          <div className="font-bold text-[#17365D] truncate">{job.title}</div>
                          <div className="text-[10px] text-[#5F6B76] truncate">{job.org} • {job.loc}</div>
                          <div className="text-[11px] font-extrabold text-[#287D73] tabular-nums">{job.pay}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-xl border border-dashed border-[#17365D]/30 bg-[#F7F9FC] space-y-2">
                  <div className="font-extrabold text-xs text-[#17365D] flex items-center justify-between">
                    <span>लाभार्थी ऑफलाइन चेकलिस्ट (Offline Checklist):</span>
                    <span className="text-[10px] text-[#5F6B76]">घर पर सुरक्षित रखें</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#202B36]">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 rounded-sm inline-block flex-shrink-0" />
                      <span>1. आधार कार्ड एवं बैंक पासबुक की छायाप्रति</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 rounded-sm inline-block flex-shrink-0" />
                      <span>2. नजदीकी कौशल केंद्र (KVK / PMKVY) में संपर्क</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 rounded-sm inline-block flex-shrink-0" />
                      <span>3. प्रशिक्षण सत्र में निःशुल्क नामांकन</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 rounded-sm inline-block flex-shrink-0" />
                      <span>4. NSQF प्रमाणन व स्थानीय रोजगार मेला</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#DCE3EA] flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-[#5F6B76] tabular-nums">
                  <div>
                    <strong>राष्ट्रीय कौशल हेल्पलाइन:</strong> 088000-55555 | <strong>जीविका सहायता:</strong> 1800-345-6789
                  </div>
                  <div className="text-right">
                    <span>Generated by JeevikaAI Civic Engine · Offline Portable Document</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs leading-relaxed bg-white p-5 rounded-xl border border-[#DCE3EA]">
              <pre ref={preRef} className="whitespace-pre-wrap break-words font-sans text-xs">
                {data.text}
              </pre>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-[#DCE3EA] bg-white flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`min-h-[42px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white transition-colors ${
                isGeneratingPdf ? 'bg-slate-400 cursor-wait' : 'bg-[#17365D] hover:bg-[#245A91]'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>PDF बन रहा है...</span>
                </>
              ) : (
                <>
                  <Icon name="download" size={16} />
                  <span>Download as PDF (पीडीएफ डाउनलोड)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE3EA] bg-[#F7F9FC] hover:bg-slate-100 text-[#17365D] text-xs font-bold transition-colors"
              title="सीधे प्रिंट करें"
            >
              <span>प्रिंट करें (Print)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTextFile}
              className="hidden sm:inline-flex min-h-[42px] items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#5F6B76] hover:bg-[#F7F9FC] transition-colors"
            >
              <span>.txt फाइल</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#5F6B76] hover:bg-[#F7F9FC] transition-colors"
            >
              <Icon name="copy" size={14} />
              <span>Copy</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-[#5F6B76] hover:text-[#17365D] hover:bg-[#F7F9FC] transition-colors"
          >
            बंद करें (Close)
          </button>
        </div>
      </div>
    </div>
  );
};

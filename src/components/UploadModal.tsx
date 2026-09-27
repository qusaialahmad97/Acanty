import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  FileCheck
} from 'lucide-react';
import { Invoice } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated: (invoice: Invoice) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onInvoiceCreated,
}) => {
  if (!isOpen) return null;

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<'idle' | 'reading' | 'extracting' | 'validating' | 'done'>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [extractedInvoice, setExtractedInvoice] = useState<Invoice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleInvoices = [
    {
      title: 'Snowflake Enterprise Data Cloud',
      sampleType: 'Snowflake Computing UK - Enterprise Compute & Storage Invoice ($3,888.00)',
      filename: 'Snowflake_INV_88291.pdf',
    },
    {
      title: 'GitHub Enterprise Suite & Copilot',
      sampleType: 'GitHub Inc. - Enterprise Seats & CI/CD Minutes ($2,450.00)',
      filename: 'GitHub_Enterprise_Invoice.pdf',
    },
    {
      title: 'Figma Organization & FigJam Seats',
      sampleType: 'Figma Inc. - Annual Team Licenses ($1,800.00)',
      filename: 'Figma_Licenses_Sept2026.pdf',
    },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleProcessFile = async (file: File) => {
    setSelectedFile(file);
    setProcessingState('reading');
    setProgressMsg('Reading binary document payload...');

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      let normMime = file.type || 'application/pdf';
      if (normMime === 'image/jpg') normMime = 'image/jpeg';
      
      await executeExtraction({
        documentBase64: base64Data,
        documentUrl: dataUrl,
        mimeType: normMime,
        filename: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleProcessSample = async (sample: typeof sampleInvoices[0]) => {
    await executeExtraction({
      sampleType: sample.sampleType,
      filename: sample.filename,
    });
  };

  const executeExtraction = async (payload: any) => {
    try {
      setProcessingState('extracting');
      setProgressMsg('Extracting financial entities via Gemini AI Document OCR...');

      const response = await fetch('/api/ai/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      setProcessingState('validating');
      setProgressMsg('Running deterministic validation rules & GL coding match...');

      const data = await response.json();

      setTimeout(() => {
        setProcessingState('done');
        setExtractedInvoice(data.invoice);
        onInvoiceCreated(data.invoice);
      }, 600);
    } catch (err: any) {
      alert('Invoice processing encountered an issue: ' + err.message);
      setProcessingState('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0b101c] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Upload Supplier Invoice</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports PDF, PNG, and JPG documents up to 20MB.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {processingState === 'idle' ? (
            <>
              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Click to browse or drag & drop invoice document
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  PDF, PNG, JPG files up to 20MB
                </p>
              </div>

              {/* One-Click Real Enterprise Samples */}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Or test with pre-loaded realistic sample invoices</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {sampleInvoices.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleProcessSample(sample)}
                      className="p-3 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-left flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-slate-200 group-hover:text-white">
                            {sample.title}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {sample.filename}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : processingState !== 'done' ? (
            /* Processing Pipeline View */
            <div className="py-10 px-4 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">AI Document Pipeline Active</h4>
                <p className="text-xs text-indigo-300 font-mono mt-1">{progressMsg}</p>
              </div>

              <div className="w-72 bg-slate-800 h-1.5 rounded-full overflow-hidden mx-auto mt-4">
                <div
                  className={`h-full bg-indigo-500 transition-all duration-500 ${
                    processingState === 'reading'
                      ? 'w-1/4'
                      : processingState === 'extracting'
                      ? 'w-3/4'
                      : 'w-full'
                  }`}
                />
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-2 font-mono">
                <span className={processingState === 'reading' ? 'text-indigo-400 font-semibold' : ''}>1. Read</span>
                <span>·</span>
                <span className={processingState === 'extracting' ? 'text-indigo-400 font-semibold' : ''}>2. OCR Extraction</span>
                <span>·</span>
                <span className={processingState === 'validating' ? 'text-indigo-400 font-semibold' : ''}>3. GL Validation</span>
              </div>
            </div>
          ) : (
            /* Done View */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Invoice Successfully Extracted</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Created invoice #{extractedInvoice?.invoiceNumber} for {extractedInvoice?.vendorName} ($
                  {extractedInvoice?.totalAmount.toFixed(2)})
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  View in Pipeline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

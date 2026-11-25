import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

interface QrCodeProps {
  value: string;
  size?: number;
  label?: string;
  downloadFileName?: string;
  showDownload?: boolean;
  className?: string;
}

export default function QrCode({
  value,
  size = 132,
  label = 'Scannable QR code',
  downloadFileName = 'thea-qr-code.png',
  showDownload = true,
  className = '',
}: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [highResUrl, setHighResUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl(null);
      setHighResUrl(null);
      return;
    }

    const generate = async () => {
      try {
        const [displayPng, exportPng] = await Promise.all([
          QRCode.toDataURL(value, {
            width: Math.max(size * 2, 240),
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#1A1816',
              light: '#FFFFFF',
            },
          }),
          QRCode.toDataURL(value, {
            width: 640,
            margin: 3,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#1A1816',
              light: '#FFFFFF',
            },
          }),
        ]);
        if (!cancelled) {
          setDataUrl(displayPng);
          setHighResUrl(exportPng);
        }
      } catch {
        if (!cancelled) {
          setDataUrl(null);
          setHighResUrl(null);
        }
      }
    };

    void generate();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  const handleDownload = () => {
    if (!highResUrl) return;
    const link = document.createElement('a');
    link.href = highResUrl;
    link.download = downloadFileName;
    link.click();
  };

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div
        className="rounded-lg border border-stone-200 bg-white p-1.5 shadow-sm flex items-center justify-center shrink-0"
        style={{ width: size + 12, height: size + 12 }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={label}
            width={size}
            height={size}
            className="block rounded-sm"
          />
        ) : (
          <div
            className="hq-skeleton rounded-sm"
            style={{ width: size, height: size }}
            aria-label="Generating QR code"
          />
        )}
      </div>

      {showDownload && highResUrl && (
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1 rounded-full border border-hq-borderDefault bg-hq-surface px-2.5 py-1 text-[11px] font-medium text-hq-textPrimary hover:bg-hq-elevated transition-colors"
        >
          <Download className="h-3 w-3" />
          <span>Download PNG</span>
        </button>
      )}
    </div>
  );
}

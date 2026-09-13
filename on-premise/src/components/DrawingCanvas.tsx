import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Characteristic, PinCoordinate, MeasurementValue } from '../types';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Crosshair, 
  Maximize, 
  Minimize, 
  Eye, 
  EyeOff,
  Focus,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface DrawingCanvasProps {
  imageUrl: string;
  characteristics: Characteristic[];
  activePointNo?: number | null;
  onPointSelect?: (pointNo: number) => void;
  onPinMove?: (characteristicId: string, newPin: PinCoordinate) => void;
  isEditable?: boolean;
  pointStatuses?: Record<string, 'pass' | 'warning' | 'fail' | 'empty'>;
  measuredValues?: Record<string, MeasurementValue>;
  className?: string;
  compact?: boolean;
  showLabelsDefault?: boolean;
  defaultFilterMode?: 'activeOnly' | 'all';
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  imageUrl,
  characteristics,
  activePointNo,
  onPointSelect,
  onPinMove,
  isEditable = false,
  pointStatuses = {},
  measuredValues = {},
  className = '',
  compact = false,
  showLabelsDefault = true,
  defaultFilterMode = 'activeOnly',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollStageRef = useRef<HTMLDivElement>(null);
  
  // Transform & Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [showLabels, setShowLabels] = useState<boolean>(showLabelsDefault);
  const [filterMode, setFilterMode] = useState<'activeOnly' | 'all'>(defaultFilterMode);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [draggingCharId, setDraggingCharId] = useState<string | null>(null);

  // Pan / Dragging state for canvas
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // Touch pinch-to-zoom tracking
  const touchDistanceRef = useRef<number | null>(null);

  // Reset zoom on image change
  useEffect(() => {
    setZoom(1);
  }, [imageUrl]);

  // Auto-scroll/center to active pinpoint when active point changes
  const centerOnPoint = useCallback((pointNo: number) => {
    if (!scrollStageRef.current || !containerRef.current) return;
    const activeChar = characteristics.find(c => c.pointNo === pointNo);
    if (!activeChar || !activeChar.pin) return;

    const stage = scrollStageRef.current;
    const pinX = activeChar.pin.x / 100;
    const pinY = activeChar.pin.y / 100;

    const imgWidth = containerRef.current.clientWidth * zoom;
    const imgHeight = containerRef.current.clientHeight * zoom;

    const targetScrollLeft = (pinX * imgWidth) - (stage.clientWidth / 2);
    const targetScrollTop = (pinY * imgHeight) - (stage.clientHeight / 2);

    stage.scrollTo({
      left: Math.max(0, targetScrollLeft),
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    });
  }, [characteristics, zoom]);

  useEffect(() => {
    if (activePointNo) {
      centerOnPoint(activePointNo);
    }
  }, [activePointNo, centerOnPoint]);

  // Mouse pan & pin dragging
  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingCharId) return;
    if (scrollStageRef.current && (e.button === 0 || e.button === 1)) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: scrollStageRef.current.scrollLeft,
        scrollTop: scrollStageRef.current.scrollTop,
      });
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // If dragging a pin in editable mode
    if (draggingCharId && isEditable && containerRef.current && onPinMove) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const clampedX = Math.max(2, Math.min(98, x));
      const clampedY = Math.max(2, Math.min(98, y));

      onPinMove(draggingCharId, {
        x: Number(clampedX.toFixed(1)),
        y: Number(clampedY.toFixed(1)),
      });
      return;
    }

    // If panning canvas
    if (isPanning && scrollStageRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      scrollStageRef.current.scrollLeft = panStart.scrollLeft - dx;
      scrollStageRef.current.scrollTop = panStart.scrollTop - dy;
    }
  };

  const handleStageMouseUp = () => {
    setIsPanning(false);
    setDraggingCharId(null);
  };

  // Touch event handlers for mobile/tablet pinch & pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Pinch to zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    } else if (e.touches.length === 1 && scrollStageRef.current) {
      // Single finger pan
      setPanStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        scrollLeft: scrollStageRef.current.scrollLeft,
        scrollTop: scrollStageRef.current.scrollTop,
      });
      setIsPanning(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      // Pinch zooming
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = dist - touchDistanceRef.current;
      if (Math.abs(diff) > 10) {
        setZoom(z => Math.max(0.6, Math.min(3.5, z + (diff > 0 ? 0.05 : -0.05))));
        touchDistanceRef.current = dist;
      }
    } else if (e.touches.length === 1 && isPanning && scrollStageRef.current && !draggingCharId) {
      // Pan scrolling
      const dx = e.touches[0].clientX - panStart.x;
      const dy = e.touches[0].clientY - panStart.y;
      scrollStageRef.current.scrollLeft = panStart.scrollLeft - dx;
      scrollStageRef.current.scrollTop = panStart.scrollTop - dy;
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    setIsPanning(false);
  };

  const handlePinMouseDown = (charId: string, e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    setDraggingCharId(charId);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!isEditable || !containerRef.current) return;
    if (activePointNo && onPinMove) {
      const activeChar = characteristics.find(c => c.pointNo === activePointNo);
      if (activeChar) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onPinMove(activeChar.id, {
          x: Number(Math.max(2, Math.min(98, x)).toFixed(1)),
          y: Number(Math.max(2, Math.min(98, y)).toFixed(1)),
        });
      }
    }
  };

  const getPinStyle = (char: Characteristic) => {
    const status = pointStatuses[char.id];
    const isActive = activePointNo === char.pointNo;

    if (isActive) {
      return {
        bg: 'bg-blue-600 ring-4 ring-blue-400/60 text-white font-black scale-110 z-30 shadow-2xl border-2 border-white',
        badgeBg: 'bg-slate-900/95 border-blue-400 text-blue-100 ring-2 ring-blue-500/30',
        dotColor: 'bg-blue-400',
        icon: null,
      };
    }

    if (status === 'fail') {
      return {
        bg: 'bg-rose-600 ring-2 ring-rose-300 text-white font-black z-20 shadow-md border-2 border-white',
        badgeBg: 'bg-slate-900/95 border-rose-500 text-rose-100',
        dotColor: 'bg-rose-500',
        icon: <XCircle className="w-3 h-3 text-rose-400 inline shrink-0" />,
      };
    }

    if (status === 'warning') {
      return {
        bg: 'bg-amber-500 ring-2 ring-amber-200 text-white font-black z-20 shadow-md border-2 border-white',
        badgeBg: 'bg-slate-900/95 border-amber-500 text-amber-100',
        dotColor: 'bg-amber-400',
        icon: <AlertTriangle className="w-3 h-3 text-amber-300 inline shrink-0" />,
      };
    }

    if (status === 'pass') {
      return {
        bg: 'bg-emerald-600 ring-2 ring-emerald-300 text-white font-black z-10 shadow-md border-2 border-white',
        badgeBg: 'bg-slate-900/95 border-emerald-500 text-emerald-100',
        dotColor: 'bg-emerald-400',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-400 inline shrink-0" />,
      };
    }

    // Default unmeasured pin colors by classification
    if (char.criticalClass === 'critical') {
      return {
        bg: 'bg-rose-700/90 ring-1 ring-rose-300 text-white font-bold z-10 shadow-sm border-2 border-white',
        badgeBg: 'bg-slate-900/95 border-slate-700 text-slate-200',
        dotColor: 'bg-rose-500',
        icon: null,
      };
    }
    if (char.criticalClass === 'major') {
      return {
        bg: 'bg-blue-700/90 ring-1 ring-blue-300 text-white font-bold z-10 shadow-sm border-2 border-white',
        badgeBg: 'bg-slate-900/95 border-slate-700 text-slate-200',
        dotColor: 'bg-blue-400',
        icon: null,
      };
    }
    return {
      bg: 'bg-slate-700/95 ring-1 ring-slate-400 text-white font-semibold z-10 shadow-sm border-2 border-white',
      badgeBg: 'bg-slate-900/95 border-slate-700 text-slate-300',
      dotColor: 'bg-slate-400',
      icon: null,
    };
  };

  // Filter characteristics based on view mode (Active Only vs All)
  const visibleCharacteristics = filterMode === 'activeOnly' && activePointNo
    ? characteristics.filter(c => c.pointNo === activePointNo)
    : characteristics;

  const activeChar = characteristics.find(c => c.pointNo === activePointNo);

  return (
    <div 
      className={`relative flex flex-col bg-[#0B1120] rounded-2xl border border-slate-700/80 overflow-hidden shadow-lg ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : className
      }`}
    >
      {/* Smart Blueprint Toolbar: Clean and Ergonomic */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1E293B] border-b border-slate-700 z-10 text-xs text-slate-200 select-none">
        {/* Left: View Filter (Sadece Aktif Nokta vs Tüm Noktalar) */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-white text-xs shrink-0">
            <Crosshair className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="hidden sm:inline">Teknik Resim</span>
          </div>

          {/* Mode Switcher: Sadece Aktif Nokta vs Tümü */}
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setFilterMode('activeOnly')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                filterMode === 'activeOnly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Resmi karıştırmamak için yalnızca şu an ölçülen aktif noktayı gösterir"
            >
              <Focus className="w-3 h-3 text-blue-300" />
              <span>Sadece Aktif Nokta {activePointNo ? `(#${activePointNo})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition ${
                filterMode === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tüm noktaları resim üzerinde göster"
            >
              <Layers className="w-3 h-3 text-slate-300" />
              <span>Tüm Noktalar ({characteristics.length})</span>
            </button>
          </div>

          {/* Toggle Labels */}
          <button
            type="button"
            onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition border ${
              showLabels
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Resim üzerinde değer etiketini göster/gizle"
          >
            {showLabels ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden md:inline">Etiket</span>
          </button>
        </div>

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95"
            title="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-2 py-0.5 rounded-md hover:bg-slate-700 text-[11px] font-mono font-bold text-blue-300"
            title="100% Boyut"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => setZoom(z => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95"
            title="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {activePointNo && (
            <button
              type="button"
              onClick={() => centerOnPoint(activePointNo)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95"
              title="Aktif Noktaya Odaklan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition ml-1"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Resim'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Stage with Touch Pan & Zoom */}
      <div
        ref={scrollStageRef}
        className="relative flex-1 w-full h-full min-h-[180px] overflow-auto bg-[#070B14] flex items-center justify-center p-2 sm:p-4 select-none touch-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCanvasClick}
      >
        <div
          ref={containerRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="relative max-w-full max-h-full transition-transform duration-100 ease-out shadow-2xl rounded-xl overflow-visible inline-block"
        >
          {/* Technical Drawing Blueprint Image */}
          {imageUrl.startsWith('data:application/pdf') ? (
            <object data={imageUrl} type="application/pdf" aria-label="PDF teknik resim" className="block h-[65vh] min-h-[460px] w-[min(900px,90vw)] pointer-events-none rounded-xl bg-white" />
          ) : (
            <img src={imageUrl} alt="Teknik Resim Kontrol Planı" className="w-full h-auto max-h-[75vh] object-contain block pointer-events-none rounded-xl bg-slate-900/60" referrerPolicy="no-referrer" />
          )}

          {/* Interactive Inspection Point Hotspots / Pins */}
          {visibleCharacteristics.map(char => {
            const style = getPinStyle(char);
            const isActive = activePointNo === char.pointNo;
            const coords = char.pin || { x: 50, y: 50 };
            const measuredVal = measuredValues[char.id];

            return (
              <div
                key={char.id}
                id={`pin-point-${char.pointNo}`}
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={(e) => handlePinMouseDown(char.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  onPointSelect?.(char.pointNo);
                }}
                className={`absolute group cursor-pointer transition-all duration-150 select-none ${
                  isActive ? 'z-40' : 'z-20'
                }`}
              >
                {/* Active Glowing Radar Pulse Ring */}
                {isActive && (
                  <span className="absolute -inset-3 rounded-full bg-blue-500/40 animate-ping pointer-events-none" />
                )}

                {/* Main Pin Circle Button */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shadow-xl transition-transform active:scale-90 ${style.bg}`}
                >
                  <span>{char.pointNo}</span>
                </div>

                {/* Clean, Non-Intrusive Tolerance Tag Right Beside Pin */}
                {showLabels && (
                  <div 
                    className={`absolute left-full ml-1.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-150 whitespace-nowrap z-30 ${
                      isActive ? 'scale-105' : 'opacity-90'
                    }`}
                  >
                    <div className={`px-2 py-0.5 rounded-md border backdrop-blur-md text-[10px] sm:text-[11px] font-mono font-bold shadow-lg flex items-center gap-1 ${style.badgeBg}`}>
                      <span>#{char.pointNo}:</span>
                      {(char.type||'numeric')==='numeric'?<><span className="text-white font-black">{char.nominal}{char.unit}</span><span className="text-[9px] text-slate-400">[{char.lsl}~{char.usl}]</span></>:<span className="text-white font-black">{char.type==='ok_nok'?'OK/NOK':char.type==='single_select'?'Tekli Seçim':'Çoklu Seçim'}</span>}
                      {measuredVal !== null && measuredVal !== undefined && (
                        <span className="ml-1 px-1 py-0.2 rounded bg-black/50 text-amber-300 font-black">
                          {Array.isArray(measuredVal)?measuredVal.join(', '):String(measuredVal)}
                        </span>
                      )}
                      {style.icon}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Strip: Clean & Informative */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1E293B] border-t border-slate-700/80 text-slate-300 text-[10px] sm:text-[11px] select-none">
        {/* Active Point Quick Info in Footer */}
        {activeChar ? (
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span className="font-bold text-white truncate">
              Nokta #{activeChar.pointNo}: {activeChar.name}
            </span>
            <span className="text-blue-300 font-mono hidden sm:inline">
              (Nom: {activeChar.nominal}{activeChar.unit} | Tol: [{activeChar.lsl} ~ {activeChar.usl}])
            </span>
          </div>
        ) : (
          <div className="text-slate-400 font-medium">
            Ölçüm noktası seçin
          </div>
        )}

        <div className="text-slate-400 font-medium shrink-0 ml-2">
          <span className="hidden sm:inline">Sürükle / Tekerlek veya Dokunarak Yakınlaştır</span>
          <span className="sm:hidden">Sürükle / Yakınlaştır</span>
        </div>
      </div>
    </div>
  );
};

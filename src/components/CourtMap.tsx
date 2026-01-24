import React, { useRef, useState } from 'react';
import { Zone, Coordinate, ResultType, SkillType } from '../../types';

interface TrajectoryData {
  start: Coordinate;
  end: Coordinate;
  result: ResultType;
  skill?: SkillType; 
}

interface CourtMapProps {
  label: string;
  selectedZone?: Zone;
  onCoordinateSelect?: (coord: Coordinate) => void;
  onTrajectorySelect?: (start: Coordinate, end: Coordinate) => void;
  onStartPointChange?: (coord: Coordinate) => void;
  onEndPointChange?: (coord: Coordinate) => void; 
  colorClass?: string;
  compact?: boolean;
  heatmapPoints?: (Coordinate & { result?: ResultType })[];
  trajectories?: TrajectoryData[]; 
  pendingTrajectory?: { start: Coordinate, end: Coordinate };
  startPoint?: Coordinate; 
  netPosition?: 'top' | 'bottom' | 'center'; 
  watermark?: string;
  topWatermark?: string;
  bottomWatermark?: string;
  trajectoryMode?: boolean; 
}

const CourtMap: React.FC<CourtMapProps> = ({ 
    label, selectedZone, onCoordinateSelect, onTrajectorySelect, onStartPointChange, onEndPointChange, colorClass = "bg-orange-100", 
    compact = false, heatmapPoints, trajectories, pendingTrajectory, startPoint, netPosition = 'bottom', 
    watermark, topWatermark, bottomWatermark, trajectoryMode = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [mousePos, setMousePos] = useState<Coordinate | null>(null);
  
  // Ref to store the offset between mouse click position and the actual center of the object
  const dragOffsetRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  const getPercentage = (e: React.MouseEvent | MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return { x, y }; // Allow values outside 0-100 during drag for smooth experience, clamp later if needed
  };

  // --- Handlers for dragging the Start Point ---
  const handleStartDotMouseDown = (e: React.MouseEvent) => {
      if (!trajectoryMode || !startPoint || !onStartPointChange) return;
      e.stopPropagation(); 
      e.preventDefault();

      const clickPos = getPercentage(e);
      // Calculate offset: Mouse Position - Ball Position
      dragOffsetRef.current = {
          x: clickPos.x - startPoint.x,
          y: clickPos.y - startPoint.y
      };

      setIsDraggingStart(true);

      const handleWindowMouseMove = (moveEvent: MouseEvent) => {
          const mouseP = getPercentage(moveEvent);
          // Apply offset to keep the ball under the mouse exactly where it was grabbed
          const newPos = {
              x: Math.max(0, Math.min(100, mouseP.x - dragOffsetRef.current.x)),
              y: Math.max(0, Math.min(100, mouseP.y - dragOffsetRef.current.y))
          };
          onStartPointChange(newPos); 
      };

      const handleWindowMouseUp = () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
          setIsDraggingStart(false);
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // --- Handlers for dragging the End Point ---
  const handleEndDotMouseDown = (e: React.MouseEvent) => {
      if (!trajectoryMode || !pendingTrajectory || !onEndPointChange) return;
      e.stopPropagation(); 
      e.preventDefault();

      const clickPos = getPercentage(e);
      dragOffsetRef.current = {
          x: clickPos.x - pendingTrajectory.end.x,
          y: clickPos.y - pendingTrajectory.end.y
      };

      setIsDraggingEnd(true);

      const handleWindowMouseMove = (moveEvent: MouseEvent) => {
          const mouseP = getPercentage(moveEvent);
          const newPos = {
              x: Math.max(0, Math.min(100, mouseP.x - dragOffsetRef.current.x)),
              y: Math.max(0, Math.min(100, mouseP.y - dragOffsetRef.current.y))
          };
          onEndPointChange(newPos); 
      };

      const handleWindowMouseUp = () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
          setIsDraggingEnd(false);
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // --- Handler for clicking the floor (End Point) ---
  const handleContainerClick = (e: React.MouseEvent) => {
      // If dragging, ignore click
      if (isDraggingStart || isDraggingEnd) return;

      // Clamp click values to 0-100 for safety
      const rawPos = getPercentage(e);
      const clickPos = {
          x: Math.max(0, Math.min(100, rawPos.x)),
          y: Math.max(0, Math.min(100, rawPos.y))
      };

      // If we have a start point and in trajectory mode, this click sets (or moves) the end point
      if (trajectoryMode && startPoint && onTrajectorySelect) {
          onTrajectorySelect(startPoint, clickPos);
      } else if (onCoordinateSelect) {
          onCoordinateSelect(clickPos);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (trajectoryMode && startPoint && !isDraggingStart && !isDraggingEnd && !pendingTrajectory) {
          setMousePos(getPercentage(e));
      } else {
          setMousePos(null);
      }
  };

  const handleMouseLeave = () => {
      setMousePos(null);
  };

  const getPointColor = (result?: ResultType) => {
      switch (result) {
          case 'Point': return 'bg-green-500 border-green-700'; 
          case 'Error': return 'bg-red-500 border-red-700'; 
          default: return 'bg-gray-400 border-gray-600';
      }
  };

  const getStrokeColor = (result?: ResultType, skill?: SkillType) => {
      if (skill === 'Serve' && result === 'Error') return '#3b82f6'; 
      switch (result) {
          case 'Point': return '#22c55e'; 
          case 'Error': return '#ef4444'; 
          default: return '#9ca3af'; 
      }
  };

  const isNetTop = netPosition === 'top';
  const isNetCenter = netPosition === 'center';

  return (
    <div className={`flex flex-col h-full w-full ${compact ? 'justify-center' : ''}`}>
      {!compact && label && <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 text-center">{label}</span>}
      
      {/* Outer Container */}
      <div 
        ref={containerRef}
        onClick={handleContainerClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full flex-1 min-h-0 bg-slate-400 cursor-crosshair overflow-hidden flex flex-col border border-slate-500 shadow-inner select-none`}
      >
        
        {/* Inner Court Area (80% Size) */}
        <div className={`absolute top-[10%] bottom-[10%] left-[10%] right-[10%] bg-orange-100 border-4 border-white shadow-xl z-0 box-content`}>
            {/* Watermarks */}
            {watermark && !topWatermark && !bottomWatermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                    <span className="text-6xl font-black text-slate-900 transform -rotate-12 whitespace-nowrap select-none">{watermark}</span>
                </div>
            )}
            {isNetCenter && (topWatermark || bottomWatermark) && (
                <>
                    {topWatermark && (
                        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10 z-0">
                            <span className="text-5xl font-black text-slate-900 transform -rotate-12 whitespace-nowrap select-none">{topWatermark}</span>
                        </div>
                    )}
                    {bottomWatermark && (
                        <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-none opacity-10 z-0">
                            <span className="text-5xl font-black text-slate-900 transform -rotate-12 whitespace-nowrap select-none">{bottomWatermark}</span>
                        </div>
                    )}
                </>
            )}

            {/* 3-Meter Zone (Front Court) Darkening - Realistic Court Effect */}
            {/* Using a darker orange overlay to simulate different wood staining */}
            {isNetCenter ? (
                <div className="absolute top-[33.33%] bottom-[33.33%] w-full bg-orange-900/10 pointer-events-none z-0"></div>
            ) : isNetTop ? (
                <div className="absolute top-0 h-[33.33%] w-full bg-orange-900/10 pointer-events-none z-0"></div>
            ) : (
                <div className="absolute bottom-0 h-[33.33%] w-full bg-orange-900/10 pointer-events-none z-0"></div>
            )}

            {/* Grid Lines */}
            <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
                {isNetCenter ? (
                    <>
                        <div className="absolute top-[50%] w-full h-1 bg-slate-800"></div> {/* Center Net Line */}
                        <div className="absolute top-[33.33%] w-full h-px bg-slate-800 dashed"></div> {/* Attack Line Top */}
                        <div className="absolute top-[66.66%] w-full h-px bg-slate-800 dashed"></div> {/* Attack Line Bottom */}
                    </>
                ) : (
                    <>
                        <div className={`absolute w-full h-px bg-slate-800 ${isNetTop ? 'top-[33.33%]' : 'bottom-[33.33%]'}`}></div>
                    </>
                )}
                <div className="absolute left-[33.33%] h-full w-px bg-slate-800"></div>
                <div className="absolute left-[66.66%] h-full w-px bg-slate-800"></div>
            </div>
        </div>

        {/* Visual Net */}
        {isNetCenter && (
             <div className="absolute top-[50%] left-[5%] right-[5%] h-2 bg-slate-900 z-10 shadow-md flex items-center justify-center -translate-y-1/2 rounded-full pointer-events-none">
             </div>
        )}

        {/* SVG Layer for Trajectories and Interactive Elements */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20">
            <defs>
                <marker id="arrowhead-ghost" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" />
                </marker>
                <marker id="arrowhead-draft" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#fbbf24" />
                </marker>
                <marker id="arrowhead-point" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
                </marker>
                <marker id="arrowhead-error" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                </marker>
                <marker id="arrowhead-serve-error" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
                </marker>
                <marker id="arrowhead-continue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
            </defs>

            {/* Smart Start Point Visualizer (Draggable Ball) */}
            {startPoint && (
                // Use a nested SVG positioned at the startPoint percentage.
                // This ensures exact alignment with the logic that uses percentages.
                <svg 
                    x={`${startPoint.x}%`} 
                    y={`${startPoint.y}%`} 
                    className="overflow-visible pointer-events-auto"
                >
                    <g 
                        className={`cursor-move ${isDraggingStart ? "scale-110" : "hover:scale-105"} transition-transform duration-100 ease-out`} 
                        onMouseDown={handleStartDotMouseDown}
                    >
                         {/* Invisible larger hit area for easier grabbing (60px diameter) */}
                        <circle cx="0" cy="0" r="30" fill="transparent" />
                        
                        {/* Custom Vector Volleyball (Mikasa Style - Blue/Yellow) */}
                        {/* Drawn centered at 0,0 */}
                        <g style={{ filter: 'drop-shadow(0px 4px 3px rgba(0,0,0,0.4))' }}>
                            {/* Base Ball (Yellow) */}
                            <circle cx="0" cy="0" r="14" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
                            
                            {/* Blue Panels - Simplified swirls */}
                            <path d="M-13,-5 Q0,-14 13,-5 L13,5 Q0,-4 -13,5 Z" fill="#1d4ed8" />
                            <path d="M-5,13 Q-14,0 -5,-13 L5,-13 Q-4,0 5,13 Z" fill="#1d4ed8" transform="rotate(90)" />
                            
                            {/* Panel Lines */}
                            <path d="M-14,0 Q0,-12 14,0" fill="none" stroke="#ca8a04" strokeWidth="1" opacity="0.5" />
                            <path d="M0,-14 Q12,0 0,14" fill="none" stroke="#ca8a04" strokeWidth="1" opacity="0.5" />
                            
                            {/* Gloss Effect */}
                            <circle cx="-5" cy="-5" r="6" fill="white" opacity="0.2" />
                        </g>
                    </g>
                </svg>
            )}

            {/* Ghost Line (Hover Preview) */}
            {startPoint && mousePos && !pendingTrajectory && !isDraggingStart && (
                <line 
                    x1={`${startPoint.x}%`} y1={`${startPoint.y}%`} 
                    x2={`${mousePos.x}%`} y2={`${mousePos.y}%`} 
                    stroke="#60a5fa" 
                    strokeWidth="2" 
                    strokeDasharray="4,4"
                    markerEnd="url(#arrowhead-ghost)"
                    opacity="0.7"
                />
            )}

            {/* Existing Trajectories */}
            {trajectories && trajectories.map((traj, idx) => {
                const color = getStrokeColor(traj.result, traj.skill);
                let marker = 'url(#arrowhead-continue)';
                if (traj.result === 'Point') marker = 'url(#arrowhead-point)';
                else if (traj.skill === 'Serve' && traj.result === 'Error') marker = 'url(#arrowhead-serve-error)';
                else if (traj.result === 'Error') marker = 'url(#arrowhead-error)';

                return (
                    <g key={idx} opacity="0.8">
                        <line 
                            x1={`${traj.start.x}%`} y1={`${traj.start.y}%`} 
                            x2={`${traj.end.x}%`} y2={`${traj.end.y}%`} 
                            stroke={color} strokeWidth="2" markerEnd={marker} 
                        />
                        <circle cx={`${traj.start.x}%`} cy={`${traj.start.y}%`} r="3" fill="#fbbf24" stroke="white" strokeWidth="1" />
                    </g>
                );
            })}

            {/* Confirmed Pending Trajectory (before result select) */}
            {pendingTrajectory && (
                <g opacity="1">
                    <line 
                        x1={`${pendingTrajectory.start.x}%`} y1={`${pendingTrajectory.start.y}%`} 
                        x2={`${pendingTrajectory.end.x}%`} y2={`${pendingTrajectory.end.y}%`} 
                        stroke="#fbbf24" strokeWidth="4" markerEnd="url(#arrowhead-draft)" 
                        strokeDasharray="5,5"
                    />
                    
                    {/* Draggable End Point */}
                    <svg 
                        x={`${pendingTrajectory.end.x}%`} 
                        y={`${pendingTrajectory.end.y}%`} 
                        className="overflow-visible pointer-events-auto"
                    >
                        <g 
                            className="cursor-move" 
                            onMouseDown={handleEndDotMouseDown}
                        >
                            <circle cx="0" cy="0" r="25" fill="transparent" />
                            <circle 
                                cx="0" cy="0"
                                r="6" 
                                fill="#ef4444" 
                                stroke="white" 
                                strokeWidth="2" 
                                className={isDraggingEnd ? "scale-125 transition-transform" : ""}
                            />
                            <circle cx="0" cy="0" r="12" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" />
                        </g>
                    </svg>
                </g>
            )}
        </svg>

        {selectedZone && !trajectoryMode && (!heatmapPoints || heatmapPoints.length === 0) && (
             <div className="absolute inset-0 pointer-events-none bg-orange-500/10 z-0"></div>
        )}

        {heatmapPoints && heatmapPoints.map((pt, idx) => (
            <div 
                key={idx}
                className={`absolute rounded-full border border-white shadow-sm pointer-events-none z-20 ${getPointColor(pt.result)}`}
                style={{
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    width: '10px', 
                    height: '10px', 
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.9 
                }}
            />
        ))}
      </div>
    </div>
  );
};

export default CourtMap;
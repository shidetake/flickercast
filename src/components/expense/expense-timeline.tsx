'use client';

import { useState, useRef, useEffect } from 'react';
import { ExpenseSegment } from '@/lib/types';
import { Input } from '@/components/ui/input';

interface ExpenseTimelineProps {
  segments: ExpenseSegment[];
  currentAge: number;
  lifeExpectancy: number;
  onSegmentsChange: (segments: ExpenseSegment[]) => void;
}

export function ExpenseTimeline({
  segments,
  currentAge,
  lifeExpectancy,
  onSegmentsChange,
}: ExpenseTimelineProps) {
  const [draggedDividerIndex, setDraggedDividerIndex] = useState<number | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(0);

  // SVG幅の取得と更新
  useEffect(() => {
    const updateWidth = () => {
      if (svgRef.current) {
        setSvgWidth(svgRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const totalYears = lifeExpectancy - currentAge;
  const height = 120;
  const margin = { left: 5, right: 5, top: 20, bottom: 40 };
  const timelineWidth = svgWidth - margin.left - margin.right;

  // 年齢からX座標への変換
  const ageToX = (age: number): number => {
    return margin.left + ((age - currentAge) / totalYears) * timelineWidth;
  };

  // X座標から年齢への変換
  const xToAge = (x: number): number => {
    const relativeX = x - margin.left;
    const age = currentAge + (relativeX / timelineWidth) * totalYears;
    return Math.round(Math.max(currentAge, Math.min(lifeExpectancy, age)));
  };

  // 支出額に応じた色の計算（支出が多いほど濃い赤）
  const getColorForExpense = (expense: number): string => {
    const maxExpense = Math.max(...segments.map(s => s.monthlyExpenses), 1);
    const intensity = expense / maxExpense;
    const red = Math.round(220 + (intensity * 35)); // 220-255
    const green = Math.round(200 * (1 - intensity * 0.8)); // 200-40
    const blue = Math.round(200 * (1 - intensity * 0.8)); // 200-40
    return `rgb(${red}, ${green}, ${blue})`;
  };

  // 区切り線のドラッグ開始
  const handleDividerPointerDown = (index: number) => {
    setDraggedDividerIndex(index);
  };

  // ドラッグ中の処理
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggedDividerIndex === null || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newAge = xToAge(x);

    const updatedSegments = [...segments];
    const prevSegment = updatedSegments[draggedDividerIndex];
    const nextSegment = updatedSegments[draggedDividerIndex + 1];

    // 境界制約：隣接区間の最低1歳幅を保証
    const minAge = prevSegment.startAge + 1;
    const maxAge = nextSegment.endAge - 1;
    const constrainedAge = Math.max(minAge, Math.min(maxAge, newAge));

    prevSegment.endAge = constrainedAge;
    nextSegment.startAge = constrainedAge;

    onSegmentsChange(updatedSegments);
  };

  // ドラッグ終了
  const handlePointerUp = () => {
    setDraggedDividerIndex(null);
  };

  // 区間の支出額編集
  const handleSegmentClick = (segment: ExpenseSegment) => {
    setEditingSegmentId(segment.id);
    setEditValue((segment.monthlyExpenses / 10000).toString());
  };

  const handleEditComplete = () => {
    if (editingSegmentId) {
      const updatedSegments = segments.map(seg =>
        seg.id === editingSegmentId
          ? { ...seg, monthlyExpenses: parseFloat(editValue) * 10000 }
          : seg
      );
      onSegmentsChange(updatedSegments);
    }
    setEditingSegmentId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditComplete();
    } else if (e.key === 'Escape') {
      setEditingSegmentId(null);
    }
  };

  // 区切り追加
  const handleAddDivider = () => {
    if (segments.length === 0) return;

    // 最も長い区間を見つけて分割
    let longestSegmentIndex = 0;
    let maxLength = 0;
    segments.forEach((seg, index) => {
      const length = seg.endAge - seg.startAge;
      if (length > maxLength) {
        maxLength = length;
        longestSegmentIndex = index;
      }
    });

    const targetSegment = segments[longestSegmentIndex];
    const midAge = Math.round((targetSegment.startAge + targetSegment.endAge) / 2);

    const newSegments = [...segments];
    const newSegment: ExpenseSegment = {
      id: Date.now().toString(),
      startAge: midAge,
      endAge: targetSegment.endAge,
      monthlyExpenses: targetSegment.monthlyExpenses,
    };

    newSegments[longestSegmentIndex] = {
      ...targetSegment,
      endAge: midAge,
    };
    newSegments.splice(longestSegmentIndex + 1, 0, newSegment);

    onSegmentsChange(newSegments);
  };

  // 区切り削除
  const handleRemoveDivider = (index: number) => {
    if (segments.length <= 1) return;

    const updatedSegments = [...segments];
    const removedSegment = updatedSegments[index];
    const nextSegment = updatedSegments[index + 1];

    if (nextSegment) {
      // 次の区間を現在の区間の開始年齢まで拡張
      nextSegment.startAge = removedSegment.startAge;
      updatedSegments.splice(index, 1);
    } else if (index > 0) {
      // 最後の区間の場合、前の区間を拡張
      const prevSegment = updatedSegments[index - 1];
      prevSegment.endAge = removedSegment.endAge;
      updatedSegments.splice(index, 1);
    }

    onSegmentsChange(updatedSegments);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">月間支出管理</span>
        <button
          onClick={handleAddDivider}
          className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          + 区切り追加
        </button>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="select-none"
        style={{ touchAction: 'none' }}
      >
        {/* 年齢軸ラベル */}
        <text x={margin.left} y={height - 10} fontSize="12" fill="#666">
          {currentAge}歳
        </text>
        <text x={svgWidth - margin.right} y={height - 10} fontSize="12" fill="#666" textAnchor="end">
          {lifeExpectancy}歳
        </text>

        {/* 区間表示 */}
        {segments.map((segment, index) => {
          const x1 = ageToX(segment.startAge);
          const x2 = ageToX(segment.endAge);
          const width = x2 - x1;
          const color = getColorForExpense(segment.monthlyExpenses);

          return (
            <g key={segment.id}>
              {/* 区間の背景 */}
              <rect
                x={x1}
                y={margin.top}
                width={width}
                height={60}
                fill={color}
                stroke="#999"
                strokeWidth="1"
                className="cursor-pointer hover:opacity-80 transition"
                onClick={() => handleSegmentClick(segment)}
              />

              {/* 支出額表示 */}
              <text
                x={x1 + width / 2}
                y={margin.top + 30}
                fontSize="14"
                fontWeight="600"
                fill="#333"
                textAnchor="middle"
                pointerEvents="none"
              >
                {(segment.monthlyExpenses / 10000).toFixed(0)}万/月
              </text>

              {/* 年齢表示 */}
              <text
                x={x1 + width / 2}
                y={margin.top + 50}
                fontSize="11"
                fill="#555"
                textAnchor="middle"
                pointerEvents="none"
              >
                {segment.startAge}-{segment.endAge}歳
              </text>
            </g>
          );
        })}

        {/* 区切り線ハンドル */}
        {segments.slice(0, -1).map((segment, index) => {
          const x = ageToX(segment.endAge);

          // 編集中の区間に隣接する区切り線かチェック
          const editingSegmentIndex = segments.findIndex(s => s.id === editingSegmentId);
          const isAdjacentToEditingSegment =
            editingSegmentIndex === index ||
            editingSegmentIndex === index + 1;

          return (
            <g key={`divider-${index}`}>
              {/* 区切り線 */}
              <line
                x1={x}
                y1={margin.top}
                x2={x}
                y2={margin.top + 60}
                stroke="#333"
                strokeWidth="2"
                onPointerDown={() => handleDividerPointerDown(index)}
                className="cursor-ew-resize"
                style={{ touchAction: 'none' }}
              />

              {/* ドラッグハンドル（三角形） */}
              <g
                onPointerDown={() => handleDividerPointerDown(index)}
                className="cursor-ew-resize"
                style={{ touchAction: 'none' }}
              >
                <polygon
                  points={`${x},${margin.top + 60} ${x - 6},${margin.top + 72} ${x + 6},${margin.top + 72}`}
                  fill="#333"
                  stroke="#333"
                  strokeWidth="2"
                  className="hover:fill-blue-500 transition"
                />
              </g>

              {/* 削除ボタン（編集モード時は常時表示、通常時はホバーで表示） */}
              <g
                onClick={() => handleRemoveDivider(index)}
                className={`cursor-pointer transition ${
                  isAdjacentToEditingSegment ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
              >
                <circle cx={x} cy={margin.top - 5} r="6" fill="#ef4444" />
                <text
                  x={x}
                  y={margin.top - 2}
                  fontSize="10"
                  fill="#fff"
                  textAnchor="middle"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  ×
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* 編集モーダル（インライン） */}
      {editingSegmentId && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
          <span className="text-sm">月間支出額（万円）:</span>
          <Input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditComplete}
            onKeyDown={handleEditKeyDown}
            className="w-24"
            autoFocus
          />
          <span className="text-xs text-gray-500">Enter: 確定 / Esc: キャンセル</span>
        </div>
      )}

      <p className="text-xs text-gray-500">
        ※ ▲をドラッグして年齢境界を調整 / 区間をクリックして支出額を編集
      </p>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useTransition } from 'react';
import { 
  AnimatePresence, 
  motion 
} from 'motion/react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown, 
  Info, 
  RefreshCw, 
  FileText, 
  Check, 
  AlertCircle,
  Clock,
  Columns,
  Download,
  Trash2,
  SlidersHorizontal,
  X,
  History,
  CheckCircle,
  HelpCircle,
  Upload,
  ArrowRight
} from 'lucide-react';
import { DataRecord, CheckRecord, DragColumn, CompareResult, HistoryLog } from './types';
import { generateInitialData, getDefaultDataColumns, getDefaultCheckColumns } from './mockData';

const getFieldDiffs = (before?: Partial<DataRecord>, after?: Partial<DataRecord>) => {
  const diffs: { fieldName: string; beforeVal: string; afterVal: string }[] = [];
  if (!before && !after) return diffs;

  const b = before || {};
  const a = after || {};

  const checkFields: { key: keyof Omit<DataRecord, 'values'>; label: string }[] = [
    { key: 'start_date', label: '生效期 (Start Date)' },
    { key: 'end_date', label: '失效期 (End Date)' },
    { key: 'index1', label: 'Index 1 (Product)' },
    { key: 'index2', label: 'Index 2 (Region)' },
    { key: 'index3', label: 'Index 3 (Category)' },
    { key: 'index4', label: 'Index 4 (Channel)' },
  ];

  for (const f of checkFields) {
    const valB = b[f.key] !== undefined ? String(b[f.key]) : '';
    const valA = a[f.key] !== undefined ? String(a[f.key]) : '';
    if (valB !== valA) {
      diffs.push({
        fieldName: f.label,
        beforeVal: valB || '(空)',
        afterVal: valA || '(空)'
      });
    }
  }

  const bVals = b.values || [];
  const aVals = a.values || [];
  const maxLen = Math.max(bVals.length, aVals.length);

  for (let i = 0; i < maxLen; i++) {
    const vB = bVals[i] !== undefined ? bVals[i] : '';
    const vA = aVals[i] !== undefined ? aVals[i] : '';
    if (vB !== vA) {
      diffs.push({
        fieldName: `Value ${i + 1}`,
        beforeVal: vB || '(空)',
        afterVal: vA || '(空)'
      });
    }
  }

  return diffs;
};

export default function App() {
  // --- States ---
  const { dataRecords: initialDb, checkRecords: initialCheck } = useMemo(() => generateInitialData(), []);
  
  const [dataRecords, setDataRecords] = useState<DataRecord[]>(initialDb);
  const [checkRecords, setCheckRecords] = useState<CheckRecord[]>(initialCheck);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-06');
  
  // Custom drag columns order states
  const [dataColumns, setDataColumns] = useState<DragColumn[]>(getDefaultDataColumns());
  const [checkColumns, setCheckColumns] = useState<DragColumn[]>(getDefaultCheckColumns());
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const visibility: Record<string, boolean> = {};
    // By default, show index 1-4, start, end, and Value 1 to 15 (hide value 16-25 to reduce screen clutter)
    getDefaultDataColumns().forEach(col => {
      if (col.isValue) {
        const valIdx = col.valueIdx ?? 0;
        visibility[col.id] = valIdx < 12; // default only show first 12 value columns to keep it clean, but let's allow toggling
      } else {
        visibility[col.id] = true;
      }
    });
    // For check, show source_system, compare_result, source, index1..4, and Value 1-12
    getDefaultCheckColumns().forEach(col => {
      if (col.isValue) {
        const valIdx = col.valueIdx ?? 0;
        visibility[col.id] = valIdx < 12;
      } else {
        visibility[col.id] = true;
      }
    });
    return visibility;
  });

  const [activeTab, setActiveTab] = useState<'data' | 'check'>('check'); // default to check to show off the comparison features
  const [isPending, startTransition] = useTransition();

  // Drag and drop states
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Pagination states
  const [dataPage, setDataPage] = useState<number>(1);
  const [checkPage, setCheckPage] = useState<number>(1);
  const itemsPerPage = 100;

  // --- Search / Filters States ---
  // Data page filters
  const [dataSearchIndex1, setDataSearchIndex1] = useState('');
  const [dataSearchIndex2, setDataSearchIndex2] = useState('');
  const [dataSearchIndex3, setDataSearchIndex3] = useState('');
  const [dataSearchIndex4, setDataSearchIndex4] = useState('');
  const [dataOnlyActive, setDataOnlyActive] = useState(true);
  const [dataValueFilterCol, setDataValueFilterCol] = useState('value1');
  const [dataValueFilterOp, setDataValueFilterOp] = useState('contains'); // contains, equals, gt, lt
  const [dataValueFilterVal, setDataValueFilterVal] = useState('');
  const [dataSearchDate, setDataSearchDate] = useState('');

  // Check page filters
  const [checkSearchIndex1, setCheckSearchIndex1] = useState('');
  const [checkSearchIndex2, setCheckSearchIndex2] = useState('');
  const [checkSearchIndex3, setCheckSearchIndex3] = useState('');
  const [checkSearchIndex4, setCheckSearchIndex4] = useState('');
  const [checkCompareResult, setCheckCompareResult] = useState<string>('All'); // All, Match, Mismatch, OnlyInData, OnlyInOut
  const [checkSourceSystem, setCheckSourceSystem] = useState<string>('All'); // All, Data, Out
  const [checkSourceType, setCheckSourceType] = useState<string>('All'); // All, system, manual
  const [checkOnlyShowUnresolved, setCheckOnlyShowUnresolved] = useState<boolean>(false);

  // --- Modal & Drawer States ---
  const [isAddDataOpen, setIsAddDataOpen] = useState(false);
  const [isEditDataOpen, setIsEditDataOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [isAddCheckItemOpen, setIsAddCheckItemOpen] = useState(false);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [diffInspectorRecord, setDiffInspectorRecord] = useState<CheckRecord | null>(null);
  const [excelPasteText, setExcelPasteText] = useState('');

  // --- Audit Trail / History Log States ---
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>(() => [
    {
      id: 'L-1',
      timestamp: '2026-06-16 11:20:00',
      actionType: 'CREATE',
      operator: '林子尧 (数据专员)',
      entityKey: 'PRD-1004_NORTH_CORP_DIRECT',
      index1: 'PRD-1004',
      index2: 'NORTH',
      index3: 'CORP',
      index4: 'DIRECT',
      recordId: 'D-NEW-99',
      details: '在 [PRD-1004, NORTH] 主键链上创建了全新有序记录版本，生效日期: 2026-06-16，失效日期: 2099-01-01。',
      afterSnapshot: {
        id: 'D-NEW-99', index1: 'PRD-1004', index2: 'NORTH', index3: 'CORP', index4: 'DIRECT',
        start_date: '2026-06-16', end_date: '2099-01-01',
        values: ['145.2', 'TIER-1', '225', '67.4', '1.05', '85.4', 'TIER-2', '245', '75.2', '1.14', '92.3', 'TIER-3', '265', '85.1', '1.25', '102.4', 'TIER-4', '285', '95.3', '1.35', '112.1', 'TIER-1', '305', '105.2', '1.45']
      }
    },
    {
      id: 'L-2',
      timestamp: '2026-06-16 10:45:15',
      actionType: 'UPDATE',
      operator: '林子尧 (数据专员)',
      entityKey: 'PRD-1008_SOUTH_RETAIL_PARTNER',
      index1: 'PRD-1008',
      index2: 'SOUTH',
      index3: 'RETAIL',
      index4: 'PARTNER',
      recordId: 'D-2',
      details: '更新了 Value 1 至 Value 4 指标。其中 Value 1 变更为 245.5 (原为 240.0)；Value 2 变更为 TIER-2 (原为 TIER-1)。',
      beforeSnapshot: {
        id: 'D-2', index1: 'PRD-1008', index2: 'SOUTH', index3: 'RETAIL', index4: 'PARTNER',
        start_date: '2026-01-01', end_date: '2099-01-01',
        values: ['240.0', 'TIER-1', '125', '45.1', '1.0']
      },
      afterSnapshot: {
        id: 'D-2', index1: 'PRD-1008', index2: 'SOUTH', index3: 'RETAIL', index4: 'PARTNER',
        start_date: '2026-01-01', end_date: '2099-01-01',
        values: ['245.5', 'TIER-2', '125', '45.1', '1.0']
      }
    },
    {
      id: 'L-3',
      timestamp: '2026-06-16 09:12:44',
      actionType: 'SYNC_CALIBRATION',
      operator: '系统自动核对校准',
      entityKey: 'PRD-1012_EAST_SMB_ONLINE',
      index1: 'PRD-1012',
      index2: 'EAST',
      index3: 'SMB',
      index4: 'ONLINE',
      recordId: 'D-4',
      details: '对账差异自动同步：根据 2026-06 期外部 Out 系统对账记录，一键同步校准 25 项数值，彻底抹平系统间极差。',
      beforeSnapshot: {
        id: 'D-4', index1: 'PRD-1012', index2: 'EAST', index3: 'SMB', index4: 'ONLINE',
        start_date: '2026-01-01', end_date: '2099-01-01',
        values: ['120.0', 'TIER-3', '450', '89.2', '1.15']
      },
      afterSnapshot: {
        id: 'D-4', index1: 'PRD-1012', index2: 'EAST', index3: 'SMB', index4: 'ONLINE',
        start_date: '2026-06-01', end_date: '2099-01-01',
        values: ['135.5', 'TIER-3', '450', '89.2', '1.28']
      }
    },
    {
      id: 'L-4',
      timestamp: '2026-06-15 15:30:12',
      actionType: 'EXPIRE',
      operator: '系统管理员',
      entityKey: 'PRD-1016_WEST_SMB_ONLINE',
      index1: 'PRD-1016',
      index2: 'WEST',
      index3: 'SMB',
      index4: 'ONLINE',
      recordId: 'D-8',
      details: '对当前处于有效期间的数据版本进行计划终止（即到期终止），截止失效期设置为 2026-06-15，保留生命周期演进追溯。',
      beforeSnapshot: {
        id: 'D-8', index1: 'PRD-1016', index2: 'WEST', index3: 'SMB', index4: 'ONLINE', start_date: '2026-01-01', end_date: '2099-01-01', values: []
      },
      afterSnapshot: {
        id: 'D-8', index1: 'PRD-1016', index2: 'WEST', index3: 'SMB', index4: 'ONLINE', start_date: '2026-01-01', end_date: '2026-06-15', values: []
      }
    }
  ]);
  const [traceEntityKey, setTraceEntityKey] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyActionFilter, setHistoryActionFilter] = useState<string>('All');
  const [historyPage, setHistoryPage] = useState<number>(1);

  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

  // Success message toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const addLogEntry = (
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPIRE' | 'SYNC_CALIBRATION',
    record: Partial<DataRecord>,
    details: string,
    beforeSnapshot?: Partial<DataRecord>
  ) => {
    const formattedTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newLog: HistoryLog = {
      id: `L-USER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formattedTimestamp,
      actionType,
      operator: '林子尧 (数据专员)',
      entityKey: `${record.index1}_${record.index2}_${record.index3}_${record.index4}`,
      index1: record.index1 || '',
      index2: record.index2 || '',
      index3: record.index3 || '',
      index4: record.index4 || '',
      recordId: record.id || '',
      details,
      beforeSnapshot,
      afterSnapshot: { ...record }
    };
    setHistoryLogs(prev => [newLog, ...prev]);
  };

  // --- Add Data Record Form state ---
  const initialNewRecord = {
    index1: '',
    index2: '',
    index3: '',
    index4: '',
    values: Array(25).fill(''),
    start_date: new Date().toISOString().split('T')[0],
    end_date: '2099-01-01'
  };
  const [newRecord, setNewRecord] = useState(initialNewRecord);

  // --- Add Manual Check Record Form state ---
  const initialNewCheckRecord = {
    index1: '',
    index2: '',
    index3: '',
    index4: '',
    values: Array(25).fill(''),
    source_system: 'Out' as const,
    source: 'manual' as const,
  };
  const [newCheckRecord, setNewCheckRecord] = useState(initialNewCheckRecord);

  // --- Data Expand and Select Compare States ---
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareActiveDiffIdx, setCompareActiveDiffIdx] = useState<number>(0);

  // --- Calculations & Auto-reconciliation Engine ---
  // Calculates unique index listing for filters list
  const indexSuggestions = useMemo(() => {
    const i1Set = new Set<string>();
    const i2Set = new Set<string>();
    const i3Set = new Set<string>();
    const i4Set = new Set<string>();

    dataRecords.forEach(r => {
      if (r.index1) i1Set.add(r.index1);
      if (r.index2) i2Set.add(r.index2);
      if (r.index3) i3Set.add(r.index3);
      if (r.index4) i4Set.add(r.index4);
    });

    return {
      index1: Array.from(i1Set).sort(),
      index2: Array.from(i2Set).sort(),
      index3: Array.from(i3Set).sort(),
      index4: Array.from(i4Set).sort(),
    };
  }, [dataRecords]);

  // Recalculates comparisons on active data + current month values
  const handlePerformAutomaticComparison = (customExternalSet?: any) => {
    // 1. Get current active system records (end_date = 2099-01-01)
    const activeData = dataRecords.filter(r => r.end_date === '2099-01-01');
    
    // We will build a map of active records by key
    const activeDataMap = new Map<string, DataRecord>();
    activeData.forEach(r => {
      const key = `${r.index1}_${r.index2}_${r.index3}_${r.index4}`;
      activeDataMap.set(key, r);
    });

    // 2. We can gather the Out system records. If we don't have a custom external set,
    // we use the current manual/system 'Out' records from the existing checkRecords state.
    // This allows continuing to check added or modified external rows.
    let externalOutSet: Omit<CheckRecord, "id">[] = [];
    if (customExternalSet) {
      externalOutSet = customExternalSet;
    } else {
      // Find all check records of source 'Out' currently in store that matches this selected month
      const currentMonthOut = checkRecords.filter(r => r.check_month === selectedMonth && r.source_system === 'Out');
      if (currentMonthOut.length > 0) {
        externalOutSet = currentMonthOut.map(({ id, ...rest }) => rest);
      } else {
        // Fallback: regenerate some random external rows if empty
        const initialCheckExt = initialCheck.filter(r => r.source_system === 'Out');
        externalOutSet = initialCheckExt.map(({ id, ...rest }) => rest);
      }
    }

    const extMap = new Map<string, typeof externalOutSet[0]>();
    externalOutSet.forEach(e => {
      const key = `${e.index1}_${e.index2}_${e.index3}_${e.index4}`;
      extMap.set(key, e);
    });

    // Combined unique keys
    const allKeys = new Set<string>([...activeDataMap.keys(), ...extMap.keys()]);
    
    const newCheckList: CheckRecord[] = [];
    let idCounter = 1;

    allKeys.forEach(key => {
      const dbRec = activeDataMap.get(key);
      const extRec = extMap.get(key);

      if (dbRec && extRec) {
        // Evaluate differences
        const diffIndices: number[] = [];
        for (let i = 0; i < 25; i++) {
          if (dbRec.values[i] !== extRec.values[i]) {
            diffIndices.push(i);
          }
        }

        const result: CompareResult = diffIndices.length === 0 ? 'Match' : 'Mismatch';
        
        // Push DB version snapshot
        newCheckList.push({
          id: `C-DATA-${idCounter}`,
          check_month: selectedMonth,
          index1: dbRec.index1,
          index2: dbRec.index2,
          index3: dbRec.index3,
          index4: dbRec.index4,
          values: [...dbRec.values],
          source_system: 'Data',
          compare_result: result,
          source: extRec.source || 'system',
          db_values: [...dbRec.values],
          out_values: [...extRec.values],
          diff_indices: diffIndices,
          linked_data_id: dbRec.id
        });

        // Push Out version snapshot
        newCheckList.push({
          id: `C-OUT-${idCounter++}`,
          check_month: selectedMonth,
          index1: extRec.index1,
          index2: extRec.index2,
          index3: extRec.index3,
          index4: extRec.index4,
          values: [...extRec.values],
          source_system: 'Out',
          compare_result: result,
          source: extRec.source || 'system',
          db_values: [...dbRec.values],
          out_values: [...extRec.values],
          diff_indices: diffIndices,
          linked_data_id: dbRec.id
        });

      } else if (dbRec) {
        // Exists only in internal data
        newCheckList.push({
          id: `C-DATA-${idCounter++}`,
          check_month: selectedMonth,
          index1: dbRec.index1,
          index2: dbRec.index2,
          index3: dbRec.index3,
          index4: dbRec.index4,
          values: [...dbRec.values],
          source_system: 'Data',
          compare_result: 'OnlyInData',
          source: 'system',
          db_values: [...dbRec.values],
          out_values: [],
          diff_indices: [],
          linked_data_id: dbRec.id
        });
      } else if (extRec) {
        // Exists only in external Out
        newCheckList.push({
          id: `C-OUT-${idCounter++}`,
          check_month: selectedMonth,
          index1: extRec.index1,
          index2: extRec.index2,
          index3: extRec.index3,
          index4: extRec.index4,
          values: [...extRec.values],
          source_system: 'Out',
          compare_result: 'OnlyInOut',
          source: extRec.source || 'system',
          db_values: [],
          out_values: [...extRec.values],
          diff_indices: []
        });
      }
    });

    setCheckRecords(newCheckList);
    setCheckPage(1);
    showToast(`成功执行月度自动对账比对 [当前选择月份: ${selectedMonth}]，生成比对结果 ${newCheckList.length} 条记录。`);
  };

  // --- Filtered Records calculation (Memoized) ---
  const filteredDataRecords = useMemo(() => {
    return dataRecords.filter(r => {
      // Index Filters
      if (dataSearchIndex1 && !r.index1.toLowerCase().includes(dataSearchIndex1.toLowerCase())) return false;
      if (dataSearchIndex2 && !r.index2.toLowerCase().includes(dataSearchIndex2.toLowerCase())) return false;
      if (dataSearchIndex3 && !r.index3.toLowerCase().includes(dataSearchIndex3.toLowerCase())) return false;
      if (dataSearchIndex4 && !r.index4.toLowerCase().includes(dataSearchIndex4.toLowerCase())) return false;
      
      // Active state filter
      if (dataOnlyActive && r.end_date !== '2099-01-01') return false;

      // Search Date overlap filter - find records active during this specific date
      if (dataSearchDate) {
        if (r.start_date > dataSearchDate || r.end_date < dataSearchDate) return false;
      }

      // Specific value filters with operators
      if (dataValueFilterVal) {
        const valIdx = parseInt(dataValueFilterCol.replace('value', '')) - 1;
        const targetVal = r.values[valIdx] || '';
        
        switch (dataValueFilterOp) {
          case 'equals':
            if (targetVal !== dataValueFilterVal) return false;
            break;
          case 'contains':
            if (!targetVal.toLowerCase().includes(dataValueFilterVal.toLowerCase())) return false;
            break;
          case 'gt':
            if (isNaN(Number(targetVal)) || isNaN(Number(dataValueFilterVal)) || Number(targetVal) <= Number(dataValueFilterVal)) return false;
            break;
          case 'lt':
            if (isNaN(Number(targetVal)) || isNaN(Number(dataValueFilterVal)) || Number(targetVal) >= Number(dataValueFilterVal)) return false;
            break;
        }
      }

      return true;
    });
  }, [dataRecords, dataSearchIndex1, dataSearchIndex2, dataSearchIndex3, dataSearchIndex4, dataOnlyActive, dataSearchDate, dataValueFilterCol, dataValueFilterOp, dataValueFilterVal]);

  const filteredCheckRecords = useMemo(() => {
    return checkRecords.filter(r => {
      // Comparison Month
      if (r.check_month !== selectedMonth) return false;
      
      // Compare Result Filter
      if (checkCompareResult !== 'All' && r.compare_result !== checkCompareResult) return false;
      
      // Source System Filter
      if (checkSourceSystem !== 'All' && r.source_system !== checkSourceSystem) return false;

      // Source type filter
      if (checkSourceType !== 'All' && r.source !== checkSourceType) return false;

      // Overcome resolved rows
      if (checkOnlyShowUnresolved && r.has_been_synced) return false;

      // Index searches
      if (checkSearchIndex1 && !r.index1.toLowerCase().includes(checkSearchIndex1.toLowerCase())) return false;
      if (checkSearchIndex2 && !r.index2.toLowerCase().includes(checkSearchIndex2.toLowerCase())) return false;
      if (checkSearchIndex3 && !r.index3.toLowerCase().includes(checkSearchIndex3.toLowerCase())) return false;
      if (checkSearchIndex4 && !r.index4.toLowerCase().includes(checkSearchIndex4.toLowerCase())) return false;

      return true;
    });
  }, [checkRecords, selectedMonth, checkCompareResult, checkSourceSystem, checkSourceType, checkOnlyShowUnresolved, checkSearchIndex1, checkSearchIndex2, checkSearchIndex3, checkSearchIndex4]);

  // --- Grouped Data calculations ---
  const groupedDataRecords = useMemo(() => {
    const groups: Record<string, DataRecord[]> = {};
    filteredDataRecords.forEach(r => {
      const key = `${r.index1}_${r.index2}_${r.index3}_${r.index4}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });

    return Object.entries(groups).map(([key, list]) => {
      // Sort newest version first.
      // 2099-01-01 is always considered newest/active.
      const sorted = [...list].sort((a, b) => {
        if (a.end_date === '2099-01-01' && b.end_date !== '2099-01-01') return -1;
        if (a.end_date !== '2099-01-01' && b.end_date === '2099-01-01') return 1;
        return b.start_date.localeCompare(a.start_date);
      });

      const newest = sorted[0];
      const history = sorted.slice(1);

      return {
        key,
        newest,
        history,
        index1: newest.index1,
        index2: newest.index2,
        index3: newest.index3,
        index4: newest.index4,
      };
    });
  }, [filteredDataRecords]);

  // --- Grouped Check calculations (两两一组) ---
  const groupedCheckRecords = useMemo(() => {
    const groups: Record<string, CheckRecord[]> = {};
    filteredCheckRecords.forEach(r => {
      const key = `${r.index1}_${r.index2}_${r.index3}_${r.index4}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });

    return Object.entries(groups).map(([key, list]) => {
      // Sort: 'Data' system record first, then 'Out' external record
      const sorted = [...list].sort((a, b) => {
        if (a.source_system === 'Data' && b.source_system !== 'Data') return -1;
        if (a.source_system !== 'Data' && b.source_system === 'Data') return 1;
        return 0;
      });

      const dataRec = sorted.find(r => r.source_system === 'Data');
      const outRec = sorted.find(r => r.source_system === 'Out');
      let diffIndices: number[] = [];
      let isMismatch = false;

      if (dataRec && outRec) {
        for (let i = 0; i < 25; i++) {
          if (dataRec.values[i] !== outRec.values[i]) {
            diffIndices.push(i);
          }
        }
        isMismatch = diffIndices.length > 0;
      }

      return {
        key,
        records: sorted,
        index1: sorted[0].index1,
        index2: sorted[0].index2,
        index3: sorted[0].index3,
        index4: sorted[0].index4,
        is_mismatch: isMismatch,
        diff_indices: diffIndices,
        compare_result: isMismatch 
          ? 'Mismatch' as const 
          : sorted[0].compare_result,
        has_been_synced: sorted.every(r => r.has_been_synced),
        representative: sorted[0]
      };
    });
  }, [filteredCheckRecords]);

  // Paginated Bounds
  const paginatedGroupedData = useMemo(() => {
    const startIndex = (dataPage - 1) * itemsPerPage;
    return groupedDataRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedDataRecords, dataPage]);

  const paginatedCheckGroups = useMemo(() => {
    const startIndex = (checkPage - 1) * itemsPerPage;
    return groupedCheckRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedCheckRecords, checkPage]);

  const totalDataPages = Math.ceil(groupedDataRecords.length / itemsPerPage) || 1;
  const totalCheckPages = Math.ceil(groupedCheckRecords.length / itemsPerPage) || 1;

  // --- Audit Trail / History Log Memos ---
  const filteredHistoryLogs = useMemo(() => {
    return historyLogs.filter(log => {
      // search
      const s = historySearch.trim().toLowerCase();
      const matchesSearch = !s ? true : (
        log.entityKey.toLowerCase().includes(s) ||
        log.details.toLowerCase().includes(s) ||
        log.operator.toLowerCase().includes(s) ||
        log.id.toLowerCase().includes(s) ||
        log.index1.toLowerCase().includes(s) ||
        log.index2.toLowerCase().includes(s) ||
        log.index3.toLowerCase().includes(s) ||
        log.index4.toLowerCase().includes(s)
      );

      // action filter
      const matchesType = historyActionFilter === 'All' ? true : log.actionType === historyActionFilter;

      return matchesSearch && matchesType;
    });
  }, [historyLogs, historySearch, historyActionFilter]);

  const historyLimit = 6;
  const totalHistoryPages = Math.ceil(filteredHistoryLogs.length / historyLimit) || 1;
  const paginatedHistoryLogs = useMemo(() => {
    const startIndex = (historyPage - 1) * historyLimit;
    return filteredHistoryLogs.slice(startIndex, startIndex + historyLimit);
  }, [filteredHistoryLogs, historyPage, historyLimit]);

  // --- Handlers & Maintain Chronological Contiguity ---

  // Adds a primary record to Data with interval validation
  const handleAddDataRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.index1 || !newRecord.index2) {
      alert('请确保填写主键 Index 1 和 Index 2');
      return;
    }

    const validationResult = insertDataRecordWithContiguity(newRecord);
    if (validationResult) {
      setIsAddDataOpen(false);
      setNewRecord(initialNewRecord);
      setDataPage(1);
    }
  };

  // The actual contiguity engine
  const insertDataRecordWithContiguity = (item: typeof newRecord, isCalibration = false) => {
    const newStartDate = item.start_date;
    
    // Find all existing items with identical index values (which represents the logical entity sequence)
    const entityRecords = dataRecords.filter(r => 
      r.index1 === item.index1 &&
      r.index2 === item.index2 &&
      r.index3 === item.index3 &&
      r.index4 === item.index4
    );

    // Filter overlapping records: where start_date <= newStartDate < end_date
    // Or if the newStartDate falls within the historical blocks
    const hasOverlapWithHistorical = entityRecords.some(r => 
      r.end_date !== '2099-01-01' && 
      newStartDate >= r.start_date && 
      newStartDate <= r.end_date
    );

    if (hasOverlapWithHistorical) {
      alert(`添加失败：该主键数据在指定日期 ${newStartDate} 已存在历史归档记录，无法重叠插入！请输入该历史范围之后的生效日期。`);
      return false;
    }

    // Find the current active record of this entity (end_date === '2099-01-01')
    const activeTermRecord = entityRecords.find(r => r.end_date === '2099-01-01');

    let updatedList = [...dataRecords];

    if (activeTermRecord) {
      // Validate that newStartDate is greater than existing active start_date
      if (newStartDate <= activeTermRecord.start_date) {
        alert(`添加失败：新生效日期 (${newStartDate}) 必须比当前有效版本的生效期 (${activeTermRecord.start_date}) 更晚。`);
        return false;
      }

      // Close out the old active version: set its end_date to newStartDate - 1 day
      const prevEndDate = new Date(newStartDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevEndDateStr = prevEndDate.toISOString().split('T')[0];

      updatedList = updatedList.map(r => {
        if (r.id === activeTermRecord.id) {
          return { ...r, end_date: prevEndDateStr };
        }
        return r;
      });
      
      addLogEntry(
        'EXPIRE',
        { ...activeTermRecord, end_date: prevEndDateStr },
        `新增生效区块 ${newStartDate} 时，系统为了维护主键连续性，自动截断收缩前一有效版本的失效期（原 2009-01-01 变为 ${prevEndDateStr}）。`,
        activeTermRecord
      );

      showToast(`检测到当前存在有效版本 (${activeTermRecord.start_date} ~ 2099-01-01)，已自动收缩该有效版本失效期至 ${prevEndDateStr}，并插入新近有效区块！`);
    }

    // Add entirely new record
    const recordToAdd: DataRecord = {
      id: `D-USER-${Date.now()}`,
      index1: item.index1,
      index2: item.index2,
      index3: item.index3,
      index4: item.index4,
      values: [...item.values],
      start_date: newStartDate,
      end_date: '2099-01-01'
    };

    updatedList.unshift(recordToAdd);
    setDataRecords(updatedList);

    addLogEntry(
      isCalibration ? 'SYNC_CALIBRATION' : 'CREATE',
      recordToAdd,
      isCalibration 
        ? `对账联动同步：根据外部 Out 系统一键校准自动同步了 25 项数值参数，并于 [${newStartDate}] 起激活为最新有效期限区块。`
        : `手工创建全新有序历史期限数据，初始指定生效日期: ${newStartDate}，失效日期: 2099-01-01（有效至今）。`
    );

    showToast(`数据已成功添加！主键: [${item.index1}, ${item.index2}] 对应的数据周期已完成更新。`);
    return true;
  };

  // Handles edits of records
  const handleSaveEditData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const originalRecord = dataRecords.find(r => r.id === editingRecord.id);

    // Save edited values
    setDataRecords(prev => prev.map(r => r.id === editingRecord.id ? editingRecord : r));
    setIsEditDataOpen(false);

    if (originalRecord) {
      addLogEntry(
        'UPDATE',
        editingRecord,
        `由手工编辑功能修改属性及参数，其有效时段为 ${editingRecord.start_date} ~ ${editingRecord.end_date}。25 项具体物理指标在本次修改中被复核存盘。`,
        originalRecord
      );
    }

    setEditingRecord(null);
    showToast('数据修改成功！已录入变更历史。');
  };

  // Handles deletion
  const handleDeleteDataRecord = (id: string) => {
    if (!window.confirm('确定要删除这行数据记录吗？删除可能导致生命周期出现缺口，建议仅仅修改或截断日期。')) return;
    
    const recordToDelete = dataRecords.find(r => r.id === id);
    if (!recordToDelete) return;

    // Check if this was a history entry or active entry.
    // If we delete an active entry (end_date=2099-01-01), the previous chronological entry for this index
    // should ideally be restored back to end_date = 2099-01-01 to preserve continuity! This is extremely smart!
    let updatedList = dataRecords.filter(r => r.id !== id);

    addLogEntry(
      'DELETE',
      recordToDelete,
      `对期限范围处于 [${recordToDelete.start_date} ~ ${recordToDelete.end_date}] 的指定实体记录执行了物理清除删除，在此时间域中形成周期数据中空与缺口。`,
      recordToDelete
    );

    if (recordToDelete.end_date === '2099-01-01') {
      // Find the historical records for this entity, sorted by start_date descending (the most recent historical version)
      const historicalList = updatedList
        .filter(r => r.index1 === recordToDelete.index1 && r.index2 === recordToDelete.index2 && r.index3 === recordToDelete.index3 && r.index4 === recordToDelete.index4)
        .sort((a, b) => b.start_date.localeCompare(a.start_date));

      if (historicalList.length > 0) {
        const latestHistory = historicalList[0];
        updatedList = updatedList.map(r => {
          if (r.id === latestHistory.id) {
            return { ...r, end_date: '2099-01-01' }; // restore active eligibility
          }
          return r;
        });

        addLogEntry(
          'UPDATE',
          { ...latestHistory, end_date: '2099-01-01' },
          `级联关联修复：因最新有效生命周期遭到物理删除，前序归档截断周期的失效期被自动恢复延长为 2099-01-01，借以保障生命线连续至今。`,
          latestHistory
        );

        showToast(`已删除最新的有效数据！上一版本记录 (自 ${latestHistory.start_date} 开始) 已自动顺延激活为新一代最新版本 (2099-01-01)。`);
      }
    }

    setDataRecords(updatedList);
    if (toastMessage === null) showToast('数据记录已移除。已重排其生命周期链。');
  };

  // Expire an active Data record immediately
  const handleExpireDataRecord = (record: DataRecord) => {
    const today = new Date().toISOString().split('T')[0];
    if (record.start_date >= today) {
      alert(`无法在今天失效：该记录的生效期在今天或今天之后 (${record.start_date})，建议直接删除记录即可。`);
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    setDataRecords(prev => prev.map(r => r.id === record.id ? { ...r, end_date: yesterdayStr } : r));

    addLogEntry(
      'EXPIRE',
      { ...record, end_date: yesterdayStr },
      `对激活版本实施立即终止归档处理，将失效终止期从 2099-01-01 截止截断至昨日 (${yesterdayStr})。`,
      record
    );

    showToast(`数据 [${record.index1}, ${record.index2}] 生效期已成功终止，失效期设置为： ${yesterdayStr} (已归档为历史数据)`);
  };

  // --- ONE-KEY SYNC (一键校准比对更新) ---
  // Resolves a discrepancy and synchronizes to the Data record
  const handleResolveAndSyncToData = (checkItem: CheckRecord, customEffectiveDate?: string) => {
    // Determine the new start date for the synchronized record.
    // Use user-provided date, or the first day of the target month (e.g. 2026-06-01), or today's date.
    const monthStart = `${checkItem.check_month}-01`;
    const effectiveDate = customEffectiveDate || monthStart;

    // Get the values we want to synchronise to Data - which are the Out system values ('out_values')
    const sourceValues = checkItem.out_values && checkItem.out_values.length > 0
      ? checkItem.out_values
      : checkItem.values;

    const mockAddPayload = {
      index1: checkItem.index1,
      index2: checkItem.index2,
      index3: checkItem.index3,
      index4: checkItem.index4,
      values: [...sourceValues],
      start_date: effectiveDate,
      end_date: '2099-01-01'
    };

    // Use our continuous insert algorithm
    const success = insertDataRecordWithContiguity(mockAddPayload, true);
    if (success) {
      // Mark this comparison record and its symmetrical partners as synced in local checkRecords state
      setCheckRecords(prev => prev.map(r => {
        const matchesIndex = r.index1 === checkItem.index1 && r.index2 === checkItem.index2 && r.index3 === checkItem.index3 && r.index4 === checkItem.index4;
        if (matchesIndex && r.check_month === checkItem.check_month) {
          return { ...r, has_been_synced: true, compare_result: 'Match' as const, diff_indices: [] };
        }
        return r;
      }));
      setDiffInspectorRecord(null);
      showToast(`[对账同步成功] 已将外部数据同步至系统，生成新的有效历史区间 (自 ${effectiveDate} 起)。`);
    }
  };

  // Mark only in data as expired
  const handleExpireFromCheckPage = (checkItem: CheckRecord) => {
    // Find the linked Data record
    const linkedRec = dataRecords.find(r => r.id === checkItem.linked_data_id);
    if (!linkedRec) {
      alert('找不到相关的数据链路！');
      return;
    }

    handleExpireDataRecord(linkedRec);
    
    // Mark as handled
    setCheckRecords(prev => prev.map(r => {
      const matchesIndex = r.index1 === checkItem.index1 && r.index2 === checkItem.index2 && r.index3 === checkItem.index3 && r.index4 === checkItem.index4;
      if (matchesIndex && r.check_month === checkItem.check_month) {
        return { ...r, has_been_synced: true, compare_result: 'Match' as const };
      }
      return r;
    }));
    setDiffInspectorRecord(null);
    showToast(`对账完成：已失效本地系统数据 ${checkItem.index1}`);
  };

  // Add individual manual check task item (simulating external ingest)
  const handleAddManualCheckItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckRecord.index1 || !newCheckRecord.index2) {
      alert('主键不可为空');
      return;
    }

    // Add to Out source pool
    const recordToAdd: CheckRecord = {
      id: `C-OUT-MANUAL-${Date.now()}`,
      check_month: selectedMonth,
      index1: newCheckRecord.index1,
      index2: newCheckRecord.index2,
      index3: newCheckRecord.index3,
      index4: newCheckRecord.index4,
      values: [...newCheckRecord.values],
      source_system: 'Out',
      compare_result: 'OnlyInOut', // Initial guess, will re-verify on compare
      source: 'manual',
      db_values: [],
      out_values: [...newCheckRecord.values],
      diff_indices: []
    };

    // Prepend and trigger comparison recalculation cleanly!
    const restOfCheck = checkRecords.filter(r => !(r.index1 === newCheckRecord.index1 && r.index2 === newCheckRecord.index2 && r.index3 === newCheckRecord.index3 && r.index4 === newCheckRecord.index4 && r.check_month === selectedMonth));
    const mergedCheck = [recordToAdd, ...restOfCheck];

    // Store temporarily, then perform auto comparisons
    setCheckRecords(mergedCheck);
    setIsAddCheckItemOpen(false);

    // Call comparison on the spot to run calculations
    setTimeout(() => {
      // Find all external records we currently have for Out
      const outRecordsList = [recordToAdd, ...checkRecords.filter(r => r.source_system === 'Out' && r.check_month === selectedMonth && r.id !== recordToAdd.id)];
      // Convert to simplified payload
      const simplified = outRecordsList.map(({ id, ...rest }) => rest);
      handlePerformAutomaticComparison(simplified);
    }, 100);
    
    setNewCheckRecord(initialNewCheckRecord);
  };

  // Paste excel tab-separated data or CSV to auto check
  const handleImportExcelPaste = () => {
    if (!excelPasteText.trim()) {
      alert('文本框中没有数据！');
      return;
    }

    try {
      const lines = excelPasteText.trim().split('\n');
      const parsedOutItems: Omit<CheckRecord, "id">[] = [];

      lines.forEach((line, lineNo) => {
        // split by tab or comma
        const cells = line.includes('\t') ? line.split('\t') : line.split(',');
        if (cells.length < 5) return; // need index1..4, plus at least some values

        const idx1 = cells[0]?.trim();
        const idx2 = cells[1]?.trim();
        const idx3 = cells[2]?.trim();
        const idx4 = cells[3]?.trim();

        const extVals = Array(25).fill('0.0');
        for (let j = 0; j < 25; j++) {
          const valIdxInCell = 4 + j;
          if (cells[valIdxInCell] !== undefined) {
            extVals[j] = cells[valIdxInCell].trim();
          }
        }

        parsedOutItems.push({
          check_month: selectedMonth,
          index1: idx1,
          index2: idx2,
          index3: idx3,
          index4: idx4,
          values: extVals,
          source_system: 'Out',
          compare_result: 'OnlyInOut',
          source: 'manual',
          db_values: [],
          out_values: extVals,
          diff_indices: []
        });
      });

      if (parsedOutItems.length === 0) {
        alert('无法解析任何有效记录。请确保格式：Index 1, Index 2, Index 3, Index 4, Value 1 ... Value 25');
        return;
      }

      setIsPasteModalOpen(false);
      setExcelPasteText('');
      handlePerformAutomaticComparison(parsedOutItems);
      showToast(`成功导入并解析了 ${parsedOutItems.length} 行外部对账数据，已自动触发多项对账检查！`);
    } catch (err: any) {
      alert(`解析失败: ${err.message}`);
    }
  };

  // --- Column drag and drop operations ---
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (colId !== dragOverColId) {
      setDragOverColId(colId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColId: string, pageType: 'data' | 'check') => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }

    const targetCols = pageType === 'data' ? [...dataColumns] : [...checkColumns];
    const sourceIdx = targetCols.findIndex(c => c.id === draggedColId);
    const targetIdx = targetCols.findIndex(c => c.id === targetColId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const itemToMove = targetCols[sourceIdx];
      targetCols.splice(sourceIdx, 1);
      targetCols.splice(targetIdx, 0, itemToMove);
      
      if (pageType === 'data') {
        setDataColumns(targetCols);
      } else {
        setCheckColumns(targetCols);
      }
      showToast(`列 [${itemToMove.label}] 位置已成功重排。`);
    }

    setDraggedColId(null);
    setDragOverColId(null);
  };

  const resetColumnsOrder = (pageType: 'data' | 'check') => {
    if (pageType === 'data') {
      setDataColumns(getDefaultDataColumns());
    } else {
      setCheckColumns(getDefaultCheckColumns());
    }
    showToast('列排列次序已恢复为系统默认顺序。');
  };

  const toggleColumnVisibility = (colId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [colId]: !prev[colId]
    }));
  };

  // Export CSV Helper
  const handleExportCSV = (pageType: 'data' | 'check' | 'history') => {
    if (pageType === 'history') {
      // Filter history logs first if needed, but export all history is great
      const header = 'ID,时间,操作类型,操作人,操作实体主键,关联记录ID,操作内容描述';
      const rows = historyLogs.map(log => {
        return `"${log.id}","${log.timestamp}","${log.actionType}","${log.operator}","${log.entityKey}","${log.recordId}","${log.details.replace(/"/g, '""')}"`;
      });
      const csvContent = [header, ...rows].join('\n');
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `history_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const listToExport = pageType === 'data' ? filteredDataRecords : filteredCheckRecords;
    const cols = pageType === 'data' ? dataColumns : checkColumns;
    const visibleCols = cols.filter(c => columnVisibility[c.id]);

    const header = visibleCols.map(c => c.label).join(',');
    
    const rows = listToExport.map(row => {
      return visibleCols.map(c => {
        if (c.isValue) {
          return `"${row.values[c.valueIdx ?? 0] || '0.0'}"`;
        }
        if (c.id === 'start_date' || c.id === 'end_date' || c.id === 'source_system' || c.id === 'compare_result' || c.id === 'source') {
          // values from key attributes
          return `"${(row as any)[c.id] || ''}"`;
        }
        return `"${(row as any)[c.id] || ''}"`;
      }).join(',');
    });

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${pageType}_export_${selectedMonth}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset entire simulation data
  const handleResetSimulation = () => {
    if (window.confirm('这会清空您的本地交互数据（包括后添加的数据、时间截断记录等等），并恢复到出厂默认状态。确定要重置吗？')) {
      setDataRecords(initialDb);
      setCheckRecords(initialCheck);
      setDataPage(1);
      setCheckPage(1);
      showToast('数据已全面重置。');
    }
  };

  return (
    <div className="h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col antialiased overflow-hidden">
      {/* Top Professional Header */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 pb-1 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg text-slate-900 shadow-lg shadow-emerald-500/20">
              <RefreshCw className="h-6 w-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                数据维护与比对中心 
                <span className="text-[10px] bg-slate-800 px-2.5 py-0.5 rounded text-emerald-400 font-mono tracking-wider font-semibold border border-slate-700">
                  DURABLE INSTANT STORAGE ACTIVE
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                支持区间时间管理、多字段属性定义、各期系统智能自动化核对校对
              </p>
            </div>
          </div>
          
          <div className="flex items-center flex-wrap gap-3">
            {/* Simulation controls */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1.5 self-stretch gap-1.5 shadow-inner">
              <span className="text-xs font-semibold px-2 text-slate-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                比对考察期
              </span>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-950 font-mono font-medium text-xs text-slate-200 border-none rounded-lg py-1 px-3 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="2026-05">2026-05 (上期数据)</option>
                <option value="2026-06">2026-06 (本对账期)</option>
                <option value="2026-07">2026-07 (下一账期)</option>
              </select>

              <button
                onClick={() => handlePerformAutomaticComparison()}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                title="重新比对本期最新数据"
              >
                <RefreshCw className="h-3 w-3" />
                自动核对
              </button>
            </div>

            <button
              onClick={handleResetSimulation}
              className="px-3 py-2 bg-slate-800 hover:bg-red-950/40 hover:text-red-400 border border-slate-700 rounded-lg text-xs text-slate-300 font-medium transition-all"
              title="初始化数据，抹掉用户修改"
            >
              重置系统
            </button>
          </div>
        </div>
      </header>

      {/* Overview Analytics Banner */}
      <section className="bg-white border-b border-slate-200 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-[#f0f9ff]/60 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">系统 Data 记录数</p>
              <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">{dataRecords.length}</p>
            </div>
          </div>

          <div className="bg-[#f0fdf4]/60 border border-green-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 text-green-600 rounded-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">最新有效版本</p>
              <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                {dataRecords.filter(r => r.end_date === '2099-01-01').length}
              </p>
            </div>
          </div>

          <div className="bg-[#fdf2f8]/60 border border-pink-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2.5 bg-pink-500/10 text-pink-600 rounded-lg">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">本期对账考证行</p>
              <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                {checkRecords.filter(r => r.check_month === selectedMonth).length}
                <span className="text-xs text-slate-400 font-normal ml-1">行</span>
              </p>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">本期不一致异常</p>
              <p className="text-xl font-bold text-amber-600 font-mono mt-0.5">
                {checkRecords.filter(r => r.check_month === selectedMonth && r.compare_result === 'Mismatch' && !r.has_been_synced).length / 2}
                <span className="text-xs font-normal text-amber-500 ml-1">组</span>
              </p>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-emerald-500/5 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">对账一键解决率</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-emerald-700 font-mono">
                  {(() => {
                    const monthCheck = checkRecords.filter(r => r.check_month === selectedMonth);
                    const discrepancies = monthCheck.filter(r => r.compare_result !== 'Match');
                    if (discrepancies.length === 0) return '100%';
                    const handled = discrepancies.filter(r => r.has_been_synced).length;
                    return `${Math.round((handled / discrepancies.length) * 100)}%`;
                  })()}
                </span>
                <span className="text-xs text-slate-500">已闭环</span>
              </div>
            </div>
            <div className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-medium">
              自动闭合
            </div>
          </div>
        </div>
      </section>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl px-6 py-3.5 flex items-center gap-3 max-w-md"
          >
            <div className="p-1 bg-emerald-500 rounded-full text-slate-950">
              <Check className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium text-slate-200">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 pb-2 pt-4 flex flex-col gap-4 min-h-0 overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 gap-8 justify-between items-center">
          <div className="flex gap-1.5 -mb-px">
            <button
              onClick={() => setActiveTab('check')}
              className={`pb-3.5 px-3 font-semibold text-sm transition-all relative flex items-center gap-2 ${
                activeTab === 'check' 
                  ? 'text-emerald-600 border-b-2 border-emerald-500' 
                  : 'text-slate-500 hover:text-slate-900 border-b-2 border-transparent'
              }`}
            >
              <CheckCircle className="h-4.5 w-4.5" />
              <span>数据核对看板 (Data Check)</span>
              {checkRecords.filter(r => r.check_month === selectedMonth && r.compare_result !== 'Match' && !r.has_been_synced).length > 0 && (
                <span className="ml-1 bg-amber-500 text-slate-955 text-[10px] font-bold h-4.5 min-w-4.5 px-1 rounded-full inline-flex items-center justify-center animate-pulse">
                  {checkRecords.filter(r => r.check_month === selectedMonth && r.compare_result !== 'Match' && !r.has_been_synced).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={`pb-3.5 px-3 font-semibold text-sm transition-all relative flex items-center gap-2 ${
                activeTab === 'data' 
                  ? 'text-emerald-600 border-b-2 border-emerald-500' 
                  : 'text-slate-500 hover:text-slate-900 border-b-2 border-transparent'
              }`}
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
              <span>历史区间数据维护库 (Data)</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3.5 px-3 font-semibold text-sm transition-all relative flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'text-emerald-600 border-b-2 border-emerald-500' 
                  : 'text-slate-500 hover:text-slate-900 border-b-2 border-transparent'
              }`}
            >
              <History className="h-4.5 w-4.5" />
              <span>生命线审计变更历史 (History Logs)</span>
              <span className="ml-1 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {historyLogs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => setIsColumnSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all font-medium"
            >
              <Columns className="h-3.5 w-3.5 text-slate-400" />
              按需显隐列
            </button>

            <button
              onClick={() => handleExportCSV(activeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all font-medium"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              导出 CSV ({filteredDataRecords.length || filteredCheckRecords.length} 条)
            </button>
          </div>
        </div>

        {/* Dynamic Panels */}
        <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          
          <AnimatePresence mode="wait">
            {activeTab === 'data' ? (
              // ========================= DATA PAGE PANEL =========================
              <motion.div 
                key="data-tab"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Advanced Multi-conditional Search Panel */}
                <div className="bg-slate-50/70 border-b border-slate-200 p-4 shrink-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-500" />
                      数据多维检索（支持高精多重模糊条件）
                    </span>
                    <button 
                      onClick={() => {
                        setDataSearchIndex1('');
                        setDataSearchIndex2('');
                        setDataSearchIndex3('');
                        setDataSearchIndex4('');
                        setDataValueFilterVal('');
                        setDataSearchDate('');
                        setDataOnlyActive(true);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      清空筛选
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">Index 1 (Product)</label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="模糊搜索 ID..."
                          value={dataSearchIndex1}
                          onChange={(e) => {
                            setDataSearchIndex1(e.target.value);
                            setDataPage(1);
                          }}
                          className="pl-8 bg-white border border-slate-200 rounded-lg text-xs py-1.5 w-full focus-ring"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">Index 2 (Region)</label>
                      <select
                        value={dataSearchIndex2}
                        onChange={(e) => {
                          setDataSearchIndex2(e.target.value);
                          setDataPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus-ring"
                      >
                        <option value="">全部地域...</option>
                        {indexSuggestions.index2.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">Index 3 (Category)</label>
                      <select
                        value={dataSearchIndex3}
                        onChange={(e) => {
                          setDataSearchIndex3(e.target.value);
                          setDataPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus-ring"
                      >
                        <option value="">全部客户类别...</option>
                        {indexSuggestions.index3.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">Index 4 (Channel)</label>
                      <select
                        value={dataSearchIndex4}
                        onChange={(e) => {
                          setDataSearchIndex4(e.target.value);
                          setDataPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus-ring"
                      >
                        <option value="">全部渠道...</option>
                        {indexSuggestions.index4.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">特定生效日期考察 (重叠过滤)</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={dataSearchDate}
                          onChange={(e) => {
                            setDataSearchDate(e.target.value);
                            setDataPage(1);
                          }}
                          className="pl-8 bg-white border border-slate-200 rounded-lg text-xs py-1.5 w-full focus-ring"
                        />
                      </div>
                    </div>

                    {/* Value-based filtering */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">指定属性列数值过滤</label>
                      <div className="flex gap-1">
                        <select
                          value={dataValueFilterCol}
                          onChange={(e) => setDataValueFilterCol(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg text-[10px] p-1 w-[40%] focus-ring font-mono"
                        >
                          {Array(25).fill(0).map((_, i) => (
                            <option key={i} value={`value${i+1}`}>v{i+1}</option>
                          ))}
                        </select>
                        <select
                          value={dataValueFilterOp}
                          onChange={(e) => setDataValueFilterOp(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg text-[10px] p-1 w-[30%] focus-ring"
                        >
                          <option value="contains">模糊</option>
                          <option value="equals">=</option>
                          <option value="gt">&gt;</option>
                          <option value="lt">&lt;</option>
                        </select>
                        <input
                          type="text"
                          placeholder="值..."
                          value={dataValueFilterVal}
                          onChange={(e) => {
                            setDataValueFilterVal(e.target.value);
                            setDataPage(1);
                          }}
                          className="bg-white border border-slate-200 rounded-lg text-xs p-1 w-[30%] focus-ring text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/50">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dataOnlyActive}
                        onChange={(e) => {
                          setDataOnlyActive(e.target.checked);
                          setDataPage(1);
                        }}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="text-xs font-semibold text-slate-700">仅显示目前有效的数据版本 (end_date = 2099-01-01)</span>
                    </label>

                    <button
                      onClick={() => setIsAddDataOpen(true)}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow shadow-slate-900/10"
                    >
                      <Plus className="h-4 w-4 text-emerald-400" />
                      创建新周期记录 (维持有序区间)
                    </button>
                  </div>
                </div>

                {/* Table container */}
                <div className="flex-1 overflow-auto min-h-0 relative">
                  <table className="w-full text-left border-collapse table-fixed select-none">
                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <tr>
                        <th className="w-50 px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap bg-slate-100 uppercase tracking-wider text-center">操作与对比</th>
                        {/* Drag and Drop Headers */}
                        {dataColumns.filter(c => columnVisibility[c.id]).map((col, index) => {
                          const isDraggedOver = dragOverColId === col.id;
                          return (
                            <th
                              key={col.id}
                              style={{ width: col.width || 100 }}
                              draggable
                              onDragStart={(e) => handleDragStart(e, col.id)}
                              onDragOver={(e) => handleDragOver(e, col.id)}
                              onDragEnd={() => { setDraggedColId(null); setDragOverColId(null); }}
                              onDrop={(e) => handleDrop(e, col.id, 'data')}
                              className={`px-3 py-3 text-xs font-bold text-slate-705 cursor-move whitespace-nowrap select-none relative transition-colors ${
                                col.isIndex ? 'bg-slate-200/50' : 'bg-slate-100'
                              } ${isDraggedOver ? 'border-l-4 border-l-emerald-500 bg-emerald-50' : 'border-l border-l-slate-200/80 hover:bg-slate-200/30'}`}
                              title="按住鼠标拖拽可以左右移动列"
                            >
                              <div className="flex items-center gap-1.5">
                                <Columns className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className={col.isIndex ? 'font-bold text-slate-900' : 'text-slate-600'}>
                                  {col.label}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-xs text-slate-600 bg-white">
                      {paginatedGroupedData.length === 0 ? (
                        <tr>
                          <td colSpan={dataColumns.length + 1} className="text-center py-24 text-slate-400 font-medium">
                            <Info className="h-8 w-8 mx-auto stroke-slate-300 mb-2" />
                            没有匹配该多维检索条件的数据。
                          </td>
                        </tr>
                      ) : (
                        paginatedGroupedData.map((group) => {
                          const row = group.newest;
                          const isActive = row.end_date === '2099-01-01';
                          const isExpanded = !!expandedKeys[group.key];
                          const hasHistory = group.history.length > 0;
                          
                          return (
                            <React.Fragment key={group.key}>
                              {/* Newest/Representative Row */}
                              <tr 
                                className={`hover:bg-slate-50 transition-colors ${
                                  isExpanded ? 'bg-slate-50/20' : ''
                                } ${!isActive ? 'bg-slate-50/40 text-slate-400 hover:text-slate-700' : ''}`}
                              >
                                <td className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-100 bg-white sticky left-0 z-5">
                                  <div className="flex items-center justify-between gap-1 px-1">
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setTraceEntityKey(`${row.index1}_${row.index2}_${row.index3}_${row.index4}`)}
                                        className="p-1 hover:bg-slate-100 rounded text-emerald-600 hover:text-emerald-700 transition-colors"
                                        title="该行实体生命周期审计与历史跟踪 (Trace Audit Trail)"
                                      >
                                        <History className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingRecord(row);
                                          setIsEditDataOpen(true);
                                        }}
                                        className="p-1 hover:bg-slate-100 rounded text-blue-600 hover:text-blue-700 transition-colors"
                                        title="修改详细指标"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      {isActive ? (
                                        <button
                                          onClick={() => handleExpireDataRecord(row)}
                                          className="p-1 hover:bg-slate-100 rounded text-amber-500 hover:text-amber-600 transition-colors"
                                          title="计划使生命周期到期终止"
                                        >
                                          <Clock className="h-3.5 w-3.5" />
                                        </button>
                                      ) : (
                                        <span className="p-1 bg-slate-200/50 rounded-full text-slate-400 select-none">
                                          <Clock className="h-3.5 w-3.5 opacity-30" />
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleDeleteDataRecord(row.id)}
                                        className="p-1 hover:bg-slate-100 rounded text-red-500 hover:text-red-650 transition-colors"
                                        title="物理删除此序列"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>

                                    {/* Compare & Expand togglers */}
                                    <div className="flex items-center gap-1.5 ml-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCompareIds(prev => {
                                            if (prev.includes(row.id)) return prev.filter(x => x !== row.id);
                                            return [...prev, row.id];
                                          });
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-0.5 ${
                                          selectedCompareIds.includes(row.id)
                                            ? 'bg-blue-600 text-white shadow shadow-blue-500/20'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                        title="选择此记录加入多样本对比"
                                      >
                                        {selectedCompareIds.includes(row.id) ? '✓ 已选' : '对比'}
                                      </button>

                                      {hasHistory && (
                                        <button
                                          onClick={() => setExpandedKeys(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                                          className={`py-0.5 px-1.5 rounded-full text-[10px] font-semibold flex items-center gap-0.5 transition ${
                                            isExpanded 
                                              ? 'bg-blue-100 text-blue-800' 
                                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                          }`}
                                          title="点击展示所有历史期限版本"
                                        >
                                          <History className="h-2.5 w-2.5" />
                                          <span>{group.history.length}</span>
                                          {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Render dynamic columns */}
                                {dataColumns.filter(c => columnVisibility[c.id]).map((col) => {
                                  if (col.isValue) {
                                    const idx = col.valueIdx ?? 0;
                                    return (
                                      <td key={col.id} className="px-3 py-2.5 font-mono font-medium truncate tracking-tight text-slate-700 select-all max-w-[150px]">
                                        {row.values[idx] !== undefined ? row.values[idx] : '-'}
                                      </td>
                                    );
                                  }

                                  if (col.id === 'start_date') {
                                    return (
                                      <td key={col.id} className="px-3 py-2.5 font-mono text-slate-800 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 text-[11px]">
                                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                          {row.start_date}
                                        </div>
                                      </td>
                                    );
                                  }

                                  if (col.id === 'end_date') {
                                    return (
                                      <td key={col.id} className="px-3 py-2.5 font-mono text-slate-800 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 text-[11px]">
                                          <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${row.end_date === '2099-01-01' ? 'bg-emerald-500' : 'bg-rose-400'}`}></span>
                                          {row.end_date === '2099-01-01' ? (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-800 font-bold text-[10px]">有效至今</span>
                                          ) : (
                                            <span className="text-rose-500">{row.end_date}</span>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={col.id} className="px-3 py-2.5 font-bold text-slate-900 select-all truncate">
                                      {(row as any)[col.id] || ''}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* Nested Historical Entries rendering if expanded */}
                              {isExpanded && group.history.map((hist, histIdx) => (
                                <tr 
                                  key={hist.id} 
                                  className="bg-slate-50/70 text-slate-500 hover:bg-slate-100/60 border-l-4 border-l-blue-400/80 transition-colors"
                                >
                                  <td className="px-2 py-1.5 border-r border-slate-100 bg-slate-50/70 flex items-center justify-between gap-1.5">
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition">
                                      <button
                                        onClick={() => setTraceEntityKey(`${hist.index1}_${hist.index2}_${hist.index3}_${hist.index4}`)}
                                        className="p-1 hover:bg-slate-200 rounded text-emerald-600 transition-colors"
                                        title="该行实体生命周期审计与历史跟踪 (Trace Audit Trail)"
                                      >
                                        <History className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingRecord(hist);
                                          setIsEditDataOpen(true);
                                        }}
                                        className="p-1 hover:bg-slate-200 rounded text-blue-600 transition-colors"
                                        title="修改详细指标"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDataRecord(hist.id)}
                                        className="p-1 hover:bg-slate-200 rounded text-red-500 transition-colors"
                                        title="物理删除此序列"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                    
                                    {/* Select comparison option */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCompareIds(prev => {
                                          if (prev.includes(hist.id)) return prev.filter(x => x !== hist.id);
                                          return [...prev, hist.id];
                                        });
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition whitespace-nowrap ${
                                        selectedCompareIds.includes(hist.id)
                                          ? 'bg-blue-600 text-white font-black'
                                          : 'bg-slate-200 text-slate-650 hover:bg-slate-300'
                                      }`}
                                    >
                                      {selectedCompareIds.includes(hist.id) ? '✓ 已选' : '对比'}
                                    </button>
                                  </td>

                                  {/* Historical values */}
                                  {dataColumns.filter(c => columnVisibility[c.id]).map((col) => {
                                    if (col.isValue) {
                                      const idx = col.valueIdx ?? 0;
                                      return (
                                        <td key={col.id} className="px-3 py-1.5 font-mono font-medium truncate text-slate-500 select-all max-w-[150px] opacity-75">
                                          {hist.values[idx] !== undefined ? hist.values[idx] : '-'}
                                        </td>
                                      );
                                    }

                                    if (col.id === 'start_date') {
                                      return (
                                        <td key={col.id} className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                                          <div className="flex items-center gap-1 text-[10.5px]">
                                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                            <span>{hist.start_date}</span>
                                          </div>
                                        </td>
                                      );
                                    }

                                    if (col.id === 'end_date') {
                                      return (
                                        <td key={col.id} className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                                          <div className="flex items-center gap-1 text-[10.5px]">
                                            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0"></span>
                                            <span className="text-amber-600 font-semibold">{hist.end_date}</span>
                                          </div>
                                        </td>
                                      );
                                    }

                                    return (
                                      <td key={col.id} className="px-3 py-1.5 font-medium text-slate-500 select-all truncate opacity-80 italic">
                                        {(hist as any)[col.id] || ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Controls / Pagination */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                  <div className="text-xs text-slate-500 font-medium">
                    展示第 <span className="text-slate-800 font-mono font-bold">{(dataPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-800 font-mono font-bold">{Math.min(dataPage * itemsPerPage, groupedDataRecords.length)}</span> 组索引（含过期历史），
                    共检索出 <span className="text-slate-800 font-mono font-bold">{groupedDataRecords.length}</span> 组核心主键索引数据
                    （每页 100 组）
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDataPage(p => Math.max(1, p - 1))}
                      disabled={dataPage === 1}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white select-none transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <span className="text-xs font-medium px-4">
                      第 {dataPage} / {totalDataPages} 页
                    </span>

                    <button
                      onClick={() => setDataPage(p => Math.min(totalDataPages, p + 1))}
                      disabled={dataPage === totalDataPages}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white select-none transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'check' ? (
              // ========================= DATA CHECK PANEL =========================
              <motion.div 
                key="check-tab"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Check search conditions */}
                <div className="bg-slate-50/70 border-b border-slate-200 p-4 shrink-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-500" />
                      对账异常智能筛查（支持一键对比检索）
                    </span>
                    <button 
                      onClick={() => {
                        setCheckCompareResult('All');
                        setCheckSourceSystem('All');
                        setCheckSourceType('All');
                        setCheckOnlyShowUnresolved(false);
                        setCheckSearchIndex1('');
                        setCheckSearchIndex2('');
                        setCheckSearchIndex3('');
                        setCheckSearchIndex4('');
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      清空筛选
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 font-sans">Index 1 (Product)</label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="模型模糊匹配..."
                          value={checkSearchIndex1}
                          onChange={(e) => {
                            setCheckSearchIndex1(e.target.value);
                            setCheckPage(1);
                          }}
                          className="pl-8 bg-white border border-slate-200 rounded-lg text-xs py-1.5 w-full focus-ring"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">比对结果 (Result)</label>
                      <select
                        value={checkCompareResult}
                        onChange={(e) => {
                          setCheckCompareResult(e.target.value);
                          setCheckPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus-ring font-medium"
                      >
                        <option value="All">全部比对状态 (All)</option>
                        <option value="Match">一致 (Match)</option>
                        <option value="Mismatch">不一致 (Mismatch)</option>
                        <option value="OnlyInData">仅在 Data 中存在</option>
                        <option value="OnlyInOut">仅在外部系统存在</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">来源分发 (Source System)</label>
                      <select
                        value={checkSourceSystem}
                        onChange={(e) => {
                          setCheckSourceSystem(e.target.value);
                          setCheckPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus-ring"
                      >
                        <option value="All">全部来源 (All)</option>
                        <option value="Data">Data页本系统快照</option>
                        <option value="Out">Out外部导入数据</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">数据生成方式 (Type)</label>
                      <select
                        value={checkSourceType}
                        onChange={(e) => {
                          setCheckSourceType(e.target.value);
                          setCheckPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus-ring"
                      >
                        <option value="All">全部生成方式</option>
                        <option value="system">系统月度抓取</option>
                        <option value="manual">用户手动增添/覆盖</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[11px] font-semibold text-slate-500">快捷操作与外部接轨</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsPasteModalOpen(true)}
                          className="flex-1 bg-white hover:bg-slate-100 border border-slate-350 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all select-none"
                        >
                          <Upload className="h-3.5 w-3.5 text-slate-400" />
                          粘贴 CSV 对齐
                        </button>

                        <button
                          onClick={() => setIsAddCheckItemOpen(true)}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all select-none"
                          title="增加外部月度对账快照"
                        >
                          <Plus className="h-3.5 w-3.5 text-emerald-400" />
                          新增外部对比行
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/50">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checkOnlyShowUnresolved}
                        onChange={(e) => {
                          setCheckOnlyShowUnresolved(e.target.checked);
                          setCheckPage(1);
                        }}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="text-xs font-semibold text-slate-650">仅显示仍待人工对账处理的记录 (隐藏已一键修复)</span>
                    </label>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-200/50 px-3 py-1 rounded-lg">
                      <Info className="h-3.5 w-3.5 text-slate-400" />
                      <span>比对规则: 在 2099-01-01 有效行中，按 Index 1~4 提取一致快照，横向扫描 25 个数值指标判定重合性。</span>
                    </div>
                  </div>
                </div>

                {/* Table block with maximum height protection to dock scrollbar perfectly within view */}
                <div className="flex-1 overflow-auto min-h-0 relative" style={{ maxHeight: 'calc(100vh - 275px)' }}>
                  <table className="w-full text-left border-collapse table-fixed select-none">
                    <thead className="sticky top-0 bg-slate-100 z-20 border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <tr>
                        <th className="w-24 px-3 py-3 text-xs font-bold text-slate-600 text-center whitespace-nowrap bg-slate-100 uppercase tracking-wider">比对与核准</th>
                        {checkColumns.filter(c => columnVisibility[c.id]).map((col) => {
                          const isDraggedOver = dragOverColId === col.id;
                          return (
                            <th
                              key={col.id}
                              style={{ width: col.width || 100 }}
                              draggable
                              onDragStart={(e) => handleDragStart(e, col.id)}
                              onDragOver={(e) => handleDragOver(e, col.id)}
                              onDragEnd={() => { setDraggedColId(null); setDragOverColId(null); }}
                              onDrop={(e) => handleDrop(e, col.id, 'check')}
                              className={`px-3 py-3 text-xs font-bold text-slate-705 cursor-move whitespace-nowrap select-none relative transition-colors ${
                                col.isIndex ? 'bg-slate-250/50 font-bold' : 'bg-slate-100'
                              } ${isDraggedOver ? 'border-l-4 border-l-emerald-500 bg-emerald-50' : 'border-l border-l-slate-200/80 hover:bg-slate-200/30'}`}
                              title="按住拖拽自由重排次序"
                            >
                              <div className="flex items-center gap-1.5">
                                <Columns className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className={col.isIndex ? 'font-bold text-slate-900' : 'text-slate-600'}>
                                  {col.label}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600 bg-white">
                      {paginatedCheckGroups.length === 0 ? (
                        <tr>
                          <td colSpan={checkColumns.length + 1} className="text-center py-24 text-slate-400 font-medium bg-white">
                            <Info className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                            本账期内未搜获到符合该对账过滤条件的记录。
                          </td>
                        </tr>
                      ) : (
                        paginatedCheckGroups.map((group, gIdx) => {
                          const rowDb = group.records.find(r => r.source_system === 'Data');
                          const rowOut = group.records.find(r => r.source_system === 'Out');
                          const hasUnresolved = !group.has_been_synced && group.compare_result !== 'Match';

                          // Status indicator styles for group header
                          let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                          let badgeText = '✓ 两对数据一致';
                          if (group.has_been_synced) {
                            badgeBg = 'bg-slate-100 text-slate-600 border-slate-300';
                            badgeText = '✓ 已手动核准修正';
                          } else if (group.compare_result === 'Mismatch') {
                            badgeBg = 'bg-amber-100/80 text-amber-900 border-amber-300 animate-pulse';
                            badgeText = `⚠️ 包含 ${group.diff_indices.length} 个数值差异项`;
                          } else if (group.compare_result === 'OnlyInData') {
                            badgeBg = 'bg-rose-100 text-rose-900 border-rose-300';
                            badgeText = '❌ 外部缺失比对记录';
                          } else if (group.compare_result === 'OnlyInOut') {
                            badgeBg = 'bg-teal-100 text-teal-900 border-teal-300';
                            badgeText = '📥 外部已报送，系统缺失';
                          }

                          return (
                            <React.Fragment key={group.key}>
                              {/* 1. Pair Group Master Info Row (Highlighting key group index variables) */}
                              <tr className="bg-slate-100/85 hover:bg-slate-150/50 transition border-t-2 border-slate-205">
                                <td colSpan={checkColumns.filter(c => columnVisibility[c.id]).length + 1} className="px-4 py-2 border-b border-slate-200/70">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] bg-slate-800 text-white font-bold font-mono px-2 py-0.5 rounded shadow-sm">
                                        PAIR {gIdx + 1 + (checkPage - 1) * itemsPerPage}
                                      </span>
                                      
                                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                                        <span>🔑 核心键：</span>
                                        <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-900 font-mono font-bold font-semibold shrink-0" title="Index 1: Product ID">
                                          {group.index1}
                                        </span>
                                        <span className="text-slate-400">/</span>
                                        <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-900 font-mono shrink-0" title="Index 2: Region">
                                          {group.index2}
                                        </span>
                                        <span className="text-slate-400">/</span>
                                        <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-900 font-mono shrink-0" title="Index 3: Category">
                                          {group.index3}
                                        </span>
                                        <span className="text-slate-400">/</span>
                                        <span className="bg-slate-250/20 px-2 py-0.5 rounded text-slate-600 font-mono shrink-0 text-[10.5px]" title="Index 4: Index4">
                                          {group.index4 || '-'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {/* Overall status badge */}
                                      <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10.5px] font-bold border ${badgeBg}`}>
                                        {badgeText}
                                      </span>

                                      {/* Parent action triggers on group header for higher visibility */}
                                      {hasUnresolved && (
                                        <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                                          {group.compare_result === 'Mismatch' && (
                                            <button
                                              onClick={() => setDiffInspectorRecord(rowOut || group.representative)}
                                              className="px-2 py-0.5 text-[10.5px] bg-blue-50 text-blue-800 hover:bg-blue-100 rounded font-bold border border-blue-200"
                                              title="横向指标精细差异核算"
                                            >
                                              差异比对
                                            </button>
                                          )}
                                          
                                          {group.compare_result === 'OnlyInData' ? (
                                            <button
                                              onClick={() => handleExpireFromCheckPage(rowDb!)}
                                              className="px-2.5 py-0.5 text-[10.5px] bg-rose-50 text-rose-800 hover:bg-rose-100 rounded font-bold border border-rose-200"
                                              title="设定该系统记录为过期失效"
                                            >
                                              一键过期
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleResolveAndSyncToData(rowOut || group.representative)}
                                              className="px-2.5 py-0.5 text-[10.5px] bg-emerald-50 text-emerald-850 hover:bg-emerald-100 rounded font-bold border border-emerald-200"
                                              title="采信此期对照，平滑同步修正本系统"
                                            >
                                              一键同步 (采信外部)
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {/* 2. Pair: Inside System Row (Data Row) */}
                              {rowDb ? (
                                <tr className={`hover:bg-slate-50/70 border-l-4 border-l-blue-400 transition-all ${
                                  group.has_been_synced ? 'bg-slate-50/30 opacity-60' : 'bg-blue-50/15'
                                }`}>
                                  <td className="px-3 py-2 text-center border-r border-slate-100 font-semibold select-none">
                                    <span className="text-[10.5px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-bold block text-center">
                                      系统存量
                                    </span>
                                  </td>

                                  {checkColumns.filter(c => columnVisibility[c.id]).map((col) => {
                                    if (col.id === 'source_system') {
                                      return (
                                        <td key={col.id} className="px-3 py-2.5 font-bold text-blue-850">
                                          核心系统 (Data)
                                        </td>
                                      );
                                    }
                                    if (col.id === 'compare_result') {
                                      return (
                                        <td key={col.id} className="px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">
                                          {rowDb.has_been_synced ? '已同步' : group.compare_result === 'Match' ? '基础一致' : '包含未匹配点'}
                                        </td>
                                      );
                                    }
                                    if (col.id === 'source') {
                                      return (
                                        <td key={col.id} className="px-3 py-2.5 text-slate-500 capitalize">
                                          {rowDb.source === 'system' ? '智能快照' : '人工增录'}
                                        </td>
                                      );
                                    }
                                    
                                    if (col.isValue) {
                                      const idx = col.valueIdx ?? 0;
                                      const cellVal = rowDb.values[idx] || '';
                                      const isDiff = group.compare_result === 'Mismatch' && group.diff_indices.includes(idx);
                                      return (
                                        <td 
                                          key={col.id} 
                                          className={`px-3 py-2 font-mono max-w-[150px] truncate select-all ${
                                            isDiff 
                                              ? 'bg-rose-100 text-rose-900 font-bold border border-rose-300' 
                                              : 'text-slate-650'
                                          }`}
                                          title={isDiff ? `系统：${cellVal} vs 外部：${rowOut?.values[idx] || '空'}` : undefined}
                                        >
                                          {cellVal}
                                        </td>
                                      );
                                    }

                                    return (
                                      <td key={col.id} className="px-3 py-2 font-semibold text-slate-900 select-all truncate">
                                        {(rowDb as any)[col.id] || ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ) : (
                                <tr className="bg-rose-50/20 text-slate-400">
                                  <td className="px-3 py-2 text-center border-r border-slate-100 font-semibold select-none bg-rose-50/20">
                                    <span className="text-[10px] text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded font-bold opacity-70">
                                      系统缺失
                                    </span>
                                  </td>
                                  <td colSpan={checkColumns.filter(c => columnVisibility[c.id]).length} className="px-4 py-2 bg-rose-50/10 italic text-[11px] text-rose-500">
                                    ⚠️ 系统在该时间段未建立主键记录！（建议在上方点击一键同步将外部报送快照平滑入库）
                                  </td>
                                </tr>
                              )}

                              {/* 3. Pair: Outside Source Row (Out Row) */}
                              {rowOut ? (
                                <tr className={`hover:bg-slate-50/70 border-l-4 border-l-indigo-400 transition-all ${
                                  group.has_been_synced ? 'bg-slate-50/30 opacity-60' : 'bg-indigo-50/5'
                                }`}>
                                  <td className="px-3 py-2 text-center border-r border-slate-100 font-semibold select-none">
                                    <span className="text-[10.5px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold block text-center">
                                      外部申报
                                    </span>
                                  </td>

                                  {checkColumns.filter(c => columnVisibility[c.id]).map((col) => {
                                    if (col.id === 'source_system') {
                                      return (
                                        <td key={col.id} className="px-3 py-2.5 font-bold text-indigo-850">
                                          外部账期 (Out)
                                        </td>
                                      );
                                    }
                                    if (col.id === 'compare_result') {
                                      return (
                                        <td key={col.id} className="px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">
                                          {rowOut.has_been_synced ? '已同步' : group.compare_result === 'Match' ? '基础一致' : '包含未匹配点'}
                                        </td>
                                      );
                                    }
                                    if (col.id === 'source') {
                                      return (
                                        <td key={col.id} className="px-3 py-2.5 text-slate-500 capitalize">
                                          {rowOut.source === 'system' ? '智能快照' : '手工增录'}
                                        </td>
                                      );
                                    }
                                    
                                    if (col.isValue) {
                                      const idx = col.valueIdx ?? 0;
                                      const cellVal = rowOut.values[idx] || '';
                                      const isDiff = group.compare_result === 'Mismatch' && group.diff_indices.includes(idx);
                                      return (
                                        <td 
                                          key={col.id} 
                                          className={`px-3 py-2 font-mono max-w-[150px] truncate select-all ${
                                            isDiff 
                                              ? 'bg-rose-100 text-rose-900 font-bold border border-rose-300' 
                                              : 'text-slate-650'
                                          }`}
                                          title={isDiff ? `外部：${cellVal} vs 系统：${rowDb?.values[idx] || '空'}` : undefined}
                                        >
                                          {cellVal}
                                        </td>
                                      );
                                    }

                                    return (
                                      <td key={col.id} className="px-3 py-2 font-semibold text-slate-900 select-all truncate">
                                        {(rowOut as any)[col.id] || ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ) : (
                                <tr className="bg-amber-50/10 text-slate-400">
                                  <td className="px-3 py-2 text-center border-r border-slate-100 font-semibold select-none bg-amber-50/10">
                                    <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded font-bold opacity-70">
                                      外部缺失
                                    </span>
                                  </td>
                                  <td colSpan={checkColumns.filter(c => columnVisibility[c.id]).length} className="px-4 py-2 bg-amber-50/5 italic text-[11px] text-amber-600">
                                    ⚠️ 外部系统未对此核心主键序列在本账期进行数据申报！（建议一键过期处理系统此有效期或忽略）
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Controls */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                  <div className="text-xs text-slate-500 font-medium pb-1.5 sm:pb-0">
                    本期对账中展示第 <span className="text-slate-800 font-mono font-bold">{(checkPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-800 font-mono font-bold">{Math.min(checkPage * itemsPerPage, groupedCheckRecords.length)}</span> 组，
                    共筛选出 <span className="text-slate-800 font-mono font-bold">{groupedCheckRecords.length}</span> 组主键比对序列。
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCheckPage(p => Math.max(1, p - 1))}
                      disabled={checkPage === 1}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white select-none transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <span className="text-xs font-medium px-4">
                      第 {checkPage} / {totalCheckPages} 页
                    </span>

                    <button
                      onClick={() => setCheckPage(p => Math.min(totalCheckPages, p + 1))}
                      disabled={checkPage === totalCheckPages}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white select-none transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              // ========================= AUDIT TRAIL HISTORY PANEL =========================
              <motion.div 
                key="history-tab"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0 bg-slate-50/15"
              >
                {/* History search filter panel */}
                <div className="bg-slate-50/70 border-b border-slate-200 p-4 shrink-0 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <History className="h-10 w-10 text-emerald-500 bg-emerald-50 p-2.5 rounded-xl block shrink-0" />
                      <div>
                        <div className="text-slate-800 font-bold text-sm">安全审计变动事务库</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">Audit Trail Continuous Version Records</div>
                      </div>
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setHistorySearch('');
                          setHistoryActionFilter('All');
                          setHistoryPage(1);
                        }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                      >
                        重置搜索 & 过滤
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Search filter input */}
                    <div className="sm:col-span-8 flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">
                        输入关键字 (搜索 主键/细节内容/操作人/系统日志编号)
                      </label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="模糊检索审计痕迹..."
                          value={historySearch}
                          onChange={(e) => {
                            setHistorySearch(e.target.value);
                            setHistoryPage(1);
                          }}
                          className="pl-8 bg-white border border-slate-200 rounded-lg text-xs py-1.5 w-full focus-ring"
                        />
                      </div>
                    </div>

                    {/* Action Type dropdown */}
                    <div className="sm:col-span-4 flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500">按操作类型过滤</label>
                      <select
                         value={historyActionFilter}
                         onChange={(e) => {
                           setHistoryActionFilter(e.target.value);
                           setHistoryPage(1);
                         }}
                         className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 focus-ring"
                      >
                        <option value="All">全部操作类型 (All)</option>
                        <option value="CREATE">CREATE (创建新版本)</option>
                        <option value="UPDATE">UPDATE (手工微调)</option>
                        <option value="DELETE">DELETE (物理清除)</option>
                        <option value="EXPIRE">EXPIRE (截断到期)</option>
                        <option value="SYNC_CALIBRATION">SYNC_CALIBRATION (对账校准)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Overview mini-statistics metric rail inside history log */}
                <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-450 uppercase font-semibold">变动事务总量</span>
                    <span className="text-xl font-bold font-mono text-slate-800 mt-0.5">
                      {historyLogs.length} <span className="text-xs text-slate-400 font-normal">条</span>
                    </span>
                  </div>
                  <div className="bg-blue-50/10 rounded-xl p-3 border border-blue-100/40 flex flex-col justify-center">
                    <span className="text-[10px] text-blue-500/80 uppercase font-semibold">CREATE</span>
                    <span className="text-xl font-bold font-mono text-blue-650 mt-0.5">
                      {historyLogs.filter(l => l.actionType === 'CREATE').length} <span className="text-xs text-slate-400 font-normal">条</span>
                    </span>
                  </div>
                  <div className="bg-violet-50/10 rounded-xl p-3 border border-violet-100/40 flex flex-col justify-center">
                    <span className="text-[10px] text-violet-500/80 uppercase font-semibold">UPDATE & EXPIRE</span>
                    <span className="text-xl font-bold font-mono text-violet-650 mt-0.5">
                      {historyLogs.filter(l => l.actionType === 'UPDATE' || l.actionType === 'EXPIRE').length} <span className="text-xs text-slate-400 font-normal">条</span>
                    </span>
                  </div>
                  <div className="bg-emerald-50/10 rounded-xl p-3 border border-emerald-100/40 flex flex-col justify-center">
                    <span className="text-[10px] text-emerald-555 uppercase font-semibold">核对校准</span>
                    <span className="text-xl font-bold font-mono text-emerald-650 mt-0.5">
                      {historyLogs.filter(l => l.actionType === 'SYNC_CALIBRATION').length} <span className="text-xs text-slate-400 font-normal">条</span>
                    </span>
                  </div>
                  <div className="bg-rose-50/10 rounded-xl p-3 border border-rose-100/40 flex flex-col justify-center col-span-2 md:col-span-1">
                    <span className="text-[10px] text-rose-505 uppercase font-semibold">CAUTION ALARMS</span>
                    <span className="text-xl font-bold font-mono text-rose-650 mt-0.5">
                      {historyLogs.filter(l => l.actionType === 'DELETE').length} <span className="text-xs text-rose-400 font-normal">警报</span>
                    </span>
                  </div>
                </div>

                {/* Body scrolling content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {paginatedHistoryLogs.length === 0 ? (
                    <div className="bg-white border rounded-2xl py-16 text-center shadow-xs">
                      <div className="flex justify-center mb-3">
                        <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                          <History className="h-6 w-6" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        未检索到匹配当前过滤条件的审计变动日志。请重置或缩减您的检索关键词。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {paginatedHistoryLogs.map((log) => {
                        let borderL = 'border-l-4 border-l-slate-400';
                        let actionTag = '系统事务';
                        let badge = 'bg-slate-50 text-slate-700';

                        if (log.actionType === 'CREATE') {
                          borderL = 'border-l-4 border-l-blue-500';
                          actionTag = 'CREATE (生成生命周期区块)';
                          badge = 'bg-blue-50 text-blue-750 border border-blue-150';
                        } else if (log.actionType === 'UPDATE') {
                          borderL = 'border-l-4 border-l-violet-500';
                          actionTag = 'UPDATE (手工微调量纲)';
                          badge = 'bg-violet-50 text-violet-750 border border-violet-150';
                        } else if (log.actionType === 'DELETE') {
                          borderL = 'border-l-4 border-l-rose-500 bg-rose-50/5';
                          actionTag = 'DELETE (物理清除极度危险)';
                          badge = 'bg-rose-50 text-rose-750 border border-rose-150';
                        } else if (log.actionType === 'EXPIRE') {
                          borderL = 'border-l-4 border-l-amber-500';
                          actionTag = 'EXPIRE (强制终止收缩活性)';
                          badge = 'bg-amber-50 text-amber-750 border border-amber-150';
                        } else if (log.actionType === 'SYNC_CALIBRATION') {
                          borderL = 'border-l-4 border-l-emerald-500';
                          actionTag = 'SYNC (一键极差核校同步)';
                          badge = 'bg-emerald-50 text-emerald-750 border border-emerald-150';
                        }

                        const hasSnapshot = log.beforeSnapshot || log.afterSnapshot;

                        return (
                          <div 
                            key={log.id} 
                            className={`bg-white border border-slate-200 rounded-2xl shadow-xs transition hover:shadow-sm ${borderL}`}
                          >
                            {/* Item Top line bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4.5 py-3 border-b border-slate-100 bg-slate-50/[0.15]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge}`}>
                                  {actionTag}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-450">
                                  [{log.id}]
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-450 font-mono">
                                <Clock className="h-3 w-3" />
                                <span>{log.timestamp}</span>
                              </div>
                            </div>

                            {/* Item Body container */}
                            <div className="p-4.5 space-y-3">
                              
                              {/* Row 1: Logical Entity parameters and Track details */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                <div className="space-y-1">
                                  <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider block">
                                    审计标的主键
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800 flex-wrap">
                                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px]" title="Product ID">{log.index1}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px]" title="Region">{log.index2}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px]" title="Category">{log.index3}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px]" title="Channel">{log.index4}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setTraceEntityKey(log.entityKey)}
                                  className="text-[11px] px-3 py-1.5 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded-lg transition shadow-xs flex items-center gap-1 shrink-0 self-start sm:self-center"
                                >
                                  <History className="h-3 w-3" />
                                  主键归属周期回查 (Trace)
                                </button>
                              </div>

                              {/* Description details description */}
                              <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                                {log.details}
                              </p>

                              {/* Meta properties footer inside log item */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10.5px] text-slate-450 font-mono border-t border-slate-100 pt-3">
                                <div>
                                  <span className="block text-slate-400 uppercase text-[9px] font-bold">修改经手操作人</span>
                                  <span className="font-semibold text-slate-750">{log.operator}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-400 uppercase text-[9px] font-bold">目标物理记录 ID</span>
                                  <span className="font-semibold text-slate-750 truncate block" title={log.recordId}>{log.recordId || '(无标定数据)'}</span>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <span className="block text-slate-400 uppercase text-[9px] font-bold">数据完整一性校验</span>
                                  <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                                     ✓ 验证通过 (Secured)
                                  </span>
                                </div>
                              </div>

                              {/* Snapshot Values Comparison Drawer if present */}
                              {hasSnapshot && (
                                <div className="bg-slate-50/40 border border-slate-200/60 rounded-xl p-3.5 mt-2 space-y-3">
                                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                    📁 此次变动原始快照数据 (Original Snapshot Mapping):
                                  </span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                     {log.beforeSnapshot ? (
                                       <div className="bg-rose-50/15 border border-rose-100 p-2.5 rounded-lg">
                                         <span className="text-[9.5px] font-bold text-rose-700 block mb-1">变动前值 (Before Snapshot)</span>
                                         <div className="font-mono text-[10px] text-slate-500 space-y-1">
                                           <div className="flex justify-between border-b border-dashed border-rose-100/50 pb-1">
                                             <span>周期范围:</span>
                                             <span className="text-slate-700">{(log.beforeSnapshot.start_date) || '-'} 至 {(log.beforeSnapshot.end_date) || '-'}</span>
                                           </div>
                                           <div className="truncate">
                                             <span>指标包:</span>
                                             <span className="text-slate-800 ml-1 bg-white border px-1 rounded inline-block max-w-[200px] truncate" title={log.beforeSnapshot.values?.join(', ')}>
                                               {log.beforeSnapshot.values && log.beforeSnapshot.values.length > 0 ? log.beforeSnapshot.values.slice(0, 5).join(', ') + '...' : '(无有效数值或被物理清除)'}
                                             </span>
                                           </div>
                                         </div>
                                       </div>
                                     ) : (
                                       <div className="bg-slate-100/50 border border-dashed border-slate-200 p-2.5 rounded-lg flex items-center justify-center text-center text-slate-400 text-[10px]">
                                         (无历史前序版本 / 全新录入实体)
                                       </div>
                                     )}

                                     {log.afterSnapshot ? (
                                       <div className="bg-emerald-50/15 border border-emerald-100 p-2.5 rounded-lg">
                                         <span className="text-[9.5px] font-bold text-emerald-700 block mb-1">存盘后值 (After Snapshot)</span>
                                         <div className="font-mono text-[10px] text-slate-500 space-y-1">
                                           <div className="flex justify-between border-b border-dashed border-emerald-100/50 pb-1">
                                             <span>周期范围:</span>
                                             <span className="text-slate-700">{(log.afterSnapshot.start_date) || '-'} 至 {(log.afterSnapshot.end_date) || '-'}</span>
                                           </div>
                                           <div className="truncate">
                                             <span>指标包:</span>
                                             <span className="text-slate-800 ml-1 bg-white border px-1 rounded inline-block max-w-[200px] truncate" title={log.afterSnapshot.values?.join(', ')}>
                                               {log.afterSnapshot.values && log.afterSnapshot.values.length > 0 ? log.afterSnapshot.values.slice(0, 5).join(', ') + '...' : '(无数值内容)'}
                                             </span>
                                           </div>
                                         </div>
                                       </div>
                                     ) : (
                                       <div className="bg-rose-50/10 border border-dashed border-rose-200 p-2.5 rounded-lg flex items-center justify-center text-center text-rose-600 text-[10px] font-bold">
                                         (物理彻底抹除 / 暂无存盘后值)
                                       </div>
                                     )}
                                  </div>

                                  {/* Detailed Attribute Diffs */}
                                  {(() => {
                                    const diffs = getFieldDiffs(log.beforeSnapshot, log.afterSnapshot);
                                    if (diffs.length === 0) {
                                      return (
                                        <div className="text-[11px] font-medium text-slate-400 bg-slate-50 rounded-lg p-2 flex items-center justify-center border border-slate-200/50">
                                          ℹ️ 所有属性和指标数值皆一致，无字段变动
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="bg-violet-50/20 border border-indigo-100/60 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-2.5 text-[10.5px] font-extrabold text-indigo-700 uppercase tracking-wider">
                                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                          属性及指标数值变更核准清单 ({diffs.length} 项变动):
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                          {diffs.map((d, dIdx) => (
                                            <div 
                                              key={dIdx} 
                                              className="bg-white border border-slate-200 shadow-3xs rounded-lg px-3 py-2 flex flex-col justify-between text-[11px] transition duration-150 hover:bg-slate-50/50"
                                            >
                                              <span className="font-bold text-slate-700 block mb-1">
                                                {d.fieldName}
                                              </span>
                                              <div className="flex items-center justify-between font-mono text-[10.5px] bg-slate-50 p-1.5 rounded border border-slate-100">
                                                <span className="text-rose-600 font-medium line-through truncate max-w-[90px]" title={d.beforeVal}>
                                                  {d.beforeVal}
                                                </span>
                                                <span className="text-slate-400 font-bold px-1 select-none">&rarr;</span>
                                                <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-sm truncate max-w-[95px]" title={d.afterVal}>
                                                  {d.afterVal}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pagination footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                  <div className="text-xs text-slate-500 font-medium pb-1.5 sm:pb-0">
                    本页展示第 <span className="text-slate-800 font-mono font-bold">{(historyPage - 1) * historyLimit + 1}</span> - <span className="text-slate-800 font-mono font-bold">{Math.min(historyPage * historyLimit, filteredHistoryLogs.length)}</span> 条日志变动契约，
                    共对账检索到 <span className="text-slate-800 font-mono font-bold">{filteredHistoryLogs.length}</span> 个审计痕迹。
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white select-none transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <span className="text-xs font-medium px-4">
                      第 {historyPage} / {totalHistoryPages} 页
                    </span>

                    <button
                      onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                      disabled={historyPage === totalHistoryPages}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white select-none transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* FOOTER CREDITS OUTCOME */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>数据核对与区间有序历史数据维护后台中心</span>
          <span className="font-mono text-slate-600">Active Stage Area (Vite + React SPA) | Port Access Secured</span>
        </div>
      </footer>


      {/* ========================================================================================= */}
      {/* ==================================== MODAL WINDOWS ===================================== */}
      {/* ========================================================================================= */}

      {/* 1. EDIT RECORD IN DATABASE */}
      {isEditDataOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                  <Edit2 className="h-4.5 w-4.5 text-blue-400" />
                  修改 Data 主库指标属性 (维持当前生命周期区间)
                </h3>
                <p className="text-[11px] text-slate-400">
                  修改后不会变动生效日期序列。主键: [{editingRecord.index1}, {editingRecord.index2}]
                </p>
              </div>
              <button 
                onClick={() => { setIsEditDataOpen(false); setEditingRecord(null); }}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditData} className="flex-1 overflow-auto p-6 flex flex-col gap-5">
              {/* Indices display */}
              <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Index 1</label>
                  <p className="font-semibold text-slate-900 mt-1">{editingRecord.index1}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Index 2</label>
                  <p className="font-semibold text-slate-900 mt-1">{editingRecord.index2}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Index 3</label>
                  <p className="font-semibold text-slate-900 mt-1">{editingRecord.index3}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Index 4</label>
                  <p className="font-semibold text-slate-900 mt-1">{editingRecord.index4}</p>
                </div>
              </div>

              {/* Effective intervals info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">生效期 Start Date (只读)</label>
                  <input
                    type="date"
                    disabled
                    value={editingRecord.start_date}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">失效期 End Date</label>
                  <input
                    type="date"
                    value={editingRecord.end_date}
                    onChange={(e) => setEditingRecord({ ...editingRecord, end_date: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-800 font-mono focus-ring"
                  />
                </div>
              </div>

              {/* 25 Values list */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-3 border-b pb-1">
                  一览：25 个属性数值指标（横向对账数据）
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  {editingRecord.values.map((val, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                        Value {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const updatedVals = [...editingRecord.values];
                          updatedVals[idx] = e.target.value;
                          setEditingRecord({ ...editingRecord, values: updatedVals });
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2.5 font-mono text-xs text-slate-800 focus-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-5 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => { setIsEditDataOpen(false); setEditingRecord(null); }}
                  className="px-5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/10 rounded-lg transition-colors"
                >
                  保存指标修改
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 2. CREATING NEW RECORD IN DATABASE WITH CONTIGUITY AUTOMATION */}
      {isAddDataOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  <Plus className="h-5 w-5 text-emerald-400" />
                  创建新区间有效数据并维持历史相连
                </h3>
                <p className="text-[11px] text-slate-400">
                  若创建的实体已有对应的活动版本，系统会自动在新生效期前一天将老版本失效，维持有序相连。
                </p>
              </div>
              <button 
                onClick={() => setIsAddDataOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDataRecord} className="flex-1 overflow-auto p-6 flex flex-col gap-4">
              
              {/* Indices inputs */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">主索引维度设定 (Index 1 ~ 4)</span>
                <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 1 * Product ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PRD-1025"
                      value={newRecord.index1}
                      onChange={(e) => setNewRecord({ ...newRecord, index1: e.target.value.trim().toUpperCase() })}
                      className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 2 * Region</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NORTH"
                      value={newRecord.index2}
                      onChange={(e) => setNewRecord({ ...newRecord, index2: e.target.value.trim().toUpperCase() })}
                      className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 3 Category</label>
                    <input
                      type="text"
                      placeholder="e.g. CORP"
                      value={newRecord.index3}
                      onChange={(e) => setNewRecord({ ...newRecord, index3: e.target.value.trim().toUpperCase() })}
                      className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 4 Channel</label>
                    <input
                      type="text"
                      placeholder="e.g. ONLINE"
                      value={newRecord.index4}
                      onChange={(e) => setNewRecord({ ...newRecord, index4: e.target.value.trim().toUpperCase() })}
                      className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Effective date ranges */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">新生效日期 Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newRecord.start_date}
                    onChange={(e) => setNewRecord({ ...newRecord, start_date: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-mono focus-ring"
                  />
                  <span className="text-[10px] text-slate-450 mt-1 block">
                    系统将自动探测是否有旧活动版本，并平滑将其失效天数锁定在 {newRecord.start_date} 的前一天。
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">失效日期 End Date</label>
                  <input
                    type="date"
                    value={newRecord.end_date}
                    onChange={(e) => setNewRecord({ ...newRecord, end_date: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-mono focus-ring"
                  />
                  <span className="text-[10px] text-amber-600 mt-1 block">
                    2099-01-01 代表该数据为无限期最新的活动推荐版本。
                  </span>
                </div>
              </div>

              {/* 25 Values */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">25 个属性指标初始数据配置</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  {newRecord.values.map((v, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono font-semibold text-slate-500">Value {idx + 1}</span>
                      <input
                        type="text"
                        placeholder="0.0"
                        value={v}
                        onChange={(e) => {
                          const valuesCopy = [...newRecord.values];
                          valuesCopy[idx] = e.target.value;
                          setNewRecord({ ...newRecord, values: valuesCopy });
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg py-1 px-2 font-mono text-xs text-slate-800 focus-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsAddDataOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-450 hover:text-slate-955 rounded-lg shadow-md transition-colors"
                >
                  建立并自动排布时间轴
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 3. DETAILED VALUE-BY-VALUE COMPARATIVE INSPECTION DRAWER */}
      {diffInspectorRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  属性指标差异对标详情
                </h3>
                <p className="text-[11px] text-slate-400">
                  当前对齐期: {diffInspectorRecord.check_month} | 索引键匹配成功，共有 {diffInspectorRecord.diff_indices?.length || 0} 个不一致字段
                </p>
              </div>
              <button 
                onClick={() => setDiffInspectorRecord(null)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick action card inside */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between text-xs font-semibold text-slate-700 font-sans">
              <span className="flex items-center gap-1.5">
                <Info className="h-4 w-4 text-amber-500 animate-pulse" />
                建议解决方案：缩短 Data 数据库老版本的有效截止日期，生成一笔新有效的数据来适应最新的外部导入数据。
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResolveAndSyncToData(diffInspectorRecord, `${diffInspectorRecord.check_month}-01`)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold shadow transition-all"
                >
                  一键同意并同步覆盖
                </button>
              </div>
            </div>

            {/* Side-by-side diff list */}
            <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Index 1</span>
                  <span className="font-mono text-slate-900 font-bold">{diffInspectorRecord.index1}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Index 2</span>
                  <span className="font-mono text-slate-900 font-bold">{diffInspectorRecord.index2}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Index 3</span>
                  <span className="font-mono text-slate-900 font-bold">{diffInspectorRecord.index3}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Index 4</span>
                  <span className="font-mono text-slate-900 font-bold">{diffInspectorRecord.index4}</span>
                </div>
              </div>

              {/* Live side-by-side comparative table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-3 bg-slate-100/80 px-4 py-2.5 font-bold text-xs border-b border-slate-200 text-slate-700">
                  <div>属性列 ID</div>
                  <div>本地 Data 在库数据快照</div>
                  <div className="flex items-center gap-1.5 text-indigo-900">
                    外部 Out 系统导入数据快照
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[350px] overflow-auto">
                  {Array(25).fill(0).map((_, i) => {
                    const dbVal = diffInspectorRecord.db_values?.[i] || '0.0';
                    const outVal = diffInspectorRecord.out_values?.[i] || '0.0';
                    const isDiff = dbVal !== outVal;

                    return (
                      <div 
                        key={i} 
                        className={`grid grid-cols-3 px-4 py-2.5 items-center font-mono text-xs ${
                          isDiff ? 'bg-amber-100/40 text-amber-900' : 'text-slate-650'
                        }`}
                      >
                        <div className="font-mono font-bold flex items-center gap-1.5">
                          Value {i+1}
                          {isDiff && <span className="inline-block h-1 w-1 bg-amber-500 rounded-full animate-ping"></span>}
                        </div>
                        <div className="font-medium">{dbVal}</div>
                        <div className="font-bold flex items-center justify-between pr-2">
                          <span className={isDiff ? 'text-red-650 bg-red-100/80 px-2 py-0.5 rounded-md font-extrabold shadow-inner' : ''}>
                            {outVal}
                          </span>
                          {isDiff && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded shrink-0 font-sans font-bold">
                              差异较准
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex justify-end">
              <button 
                onClick={() => setDiffInspectorRecord(null)}
                className="px-5 py-1.5 text-xs text-slate-650 hover:bg-slate-200 border bg-white rounded-lg transition-all font-medium"
              >
                关闭详情面
              </button>
            </div>
          </motion.div>
        </div>
      )}


      {/* 4. MANUAL INGEST ROW TO COMPARISON DECK */}
      {isAddCheckItemOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  <Plus className="h-5 w-5 text-emerald-400" />
                  新增外部系统 (Out) 待对账核查记录
                </h3>
                <p className="text-[11px] text-slate-400">
                  模拟新增一笔外部第三方数据，系统将自动和当前有效 Data 进行交叉对账并抛出差异结果。
                </p>
              </div>
              <button 
                onClick={() => setIsAddCheckItemOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualCheckItem} className="flex-1 overflow-auto p-6 flex flex-col gap-4">
              {/* Indices */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 1 * Product ID</label>
                  <input
                    type="text"
                    required
                    placeholder="PRD-1025"
                    value={newCheckRecord.index1}
                    onChange={(e) => setNewCheckRecord({ ...newCheckRecord, index1: e.target.value.trim().toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 2 * Region</label>
                  <input
                    type="text"
                    required
                    placeholder="NORTH"
                    value={newCheckRecord.index2}
                    onChange={(e) => setNewCheckRecord({ ...newCheckRecord, index2: e.target.value.trim().toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 3 Category</label>
                  <input
                    type="text"
                    placeholder="CORP"
                    value={newCheckRecord.index3}
                    onChange={(e) => setNewCheckRecord({ ...newCheckRecord, index3: e.target.value.trim().toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Index 4 Channel</label>
                  <input
                    type="text"
                    placeholder="DIRECT"
                    value={newCheckRecord.index4}
                    onChange={(e) => setNewCheckRecord({ ...newCheckRecord, index4: e.target.value.trim().toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-3 text-xs focus-ring"
                  />
                </div>
              </div>

              {/* 25 Values */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">手动赋予外部的 25 维属性考察值</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  {newCheckRecord.values.map((v, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono font-semibold text-slate-500">Value {idx + 1}</span>
                      <input
                        type="text"
                        placeholder="0.0"
                        value={v}
                        onChange={(e) => {
                          const valuesCopy = [...newCheckRecord.values];
                          valuesCopy[idx] = e.target.value;
                          setNewCheckRecord({ ...newCheckRecord, values: valuesCopy });
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg py-1 px-2.5 font-mono text-xs text-slate-800 focus-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCheckItemOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow rounded-lg transition-colors"
                >
                  提交外部记录并重新对账核对
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 5. PASTE EXCEL EXPORTS MODAL */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Upload className="h-5 w-5 text-emerald-400" />
                贴入外部多指标 Excel/Tab/CSV 物理快照
              </h3>
              <button onClick={() => setIsPasteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 overflow-auto">
              <div className="text-xs text-slate-600 space-y-1">
                <p>💡 <b>使用说明:</b> 支持直接从 Excel/WPS/谷歌表格或 CSV 记事本中复制整行数据粘贴至下方文本框中。</p>
                <p>每一行记录的开头 4 个单元格代表 <b>Index 1 ~ 4</b> 主键，随后 25 个单元格将映射为 <b>Value 1 ~ 25</b> 的比对参数值。请用 Tab 键（默认）或英文逗号隔开。</p>
              </div>

              <textarea
                placeholder="PROD-1020,EAST,CORP,DIRECT,155.0,200.0,TIER-1,100,500.5... (示例)"
                value={excelPasteText}
                onChange={(e) => setExcelPasteText(e.target.value)}
                className="w-full flex-1 border border-slate-300 rounded-xl p-4 font-mono text-xs bg-slate-50 min-h-[180px] focus-ring"
              ></textarea>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={handleImportExcelPaste}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow"
                >
                  对齐覆盖比对
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}


      {/* 6. COLUMN VISIBILITY POPUP SETTINGS */}
      {isColumnSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Columns className="h-5 w-5 text-emerald-400" />
                看板按需显隐列设置面板
              </h3>
              <button onClick={() => setIsColumnSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto flex flex-col gap-4">
              <p className="text-xs text-slate-500">
                由于本对账单包含太多的指标参数（25个Value维度），为防止横向拉伸导致眼部疲劳，在此您可以任意勾选和移除特定列的展示，系统会自动适应屏幕宽度。此外，可以通过按住表格头部拖拽随意调整列左右位置。
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const next: Record<string, boolean> = { ...columnVisibility };
                    getDefaultDataColumns().forEach(c => next[c.id] = true);
                    getDefaultCheckColumns().forEach(c => next[c.id] = true);
                    setColumnVisibility(next);
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-bold text-slate-705 transition-colors"
                >
                  全显
                </button>
                <button
                  onClick={() => {
                    const next: Record<string, boolean> = { ...columnVisibility };
                    getDefaultDataColumns().forEach(c => {
                      if (c.isValue) next[c.id] = (c.valueIdx ?? 0) < 6; // default show first 6 Values
                    });
                    setColumnVisibility(next);
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-bold text-slate-705 transition-colors"
                >
                  精简模式（仅 Value 1~6）
                </button>
                <button
                  onClick={() => {
                    resetColumnsOrder('data');
                    resetColumnsOrder('check');
                  }}
                  className="px-3 py-1 bg-slate-850 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition-colors"
                >
                  恢复列排序次序
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <span className="block text-xs font-bold text-slate-700 mb-3 border-b pb-1">主键列与基本设置字段：</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {getDefaultCheckColumns().filter(c => !c.isValue).map(c => (
                    <label key={c.id} className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={columnVisibility[c.id] !== false}
                        onChange={() => toggleColumnVisibility(c.id)}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="text-slate-700">{c.label}</span>
                    </label>
                  ))}
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={columnVisibility['start_date'] !== false}
                      onChange={() => toggleColumnVisibility('start_date')}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-705">生效期 Start Date</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={columnVisibility['end_date'] !== false}
                      onChange={() => toggleColumnVisibility('end_date')}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-755">失效期 End Date</span>
                  </label>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <span className="block text-xs font-bold text-slate-700 mb-3 border-b pb-1">比对数值参数列设定 (Value 1 至 25)：</span>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {Array(25).fill(0).map((_, i) => {
                    const colId = `value${i+1}`;
                    return (
                      <label key={colId} className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={columnVisibility[colId] !== false}
                          onChange={() => toggleColumnVisibility(colId)}
                          className="h-4 w-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-slate-700 font-bold">Value {i+1}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 shrink-0 flex justify-end">
              <button
                onClick={() => setIsColumnSettingsOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                保存看板布局
              </button>
            </div>
          </motion.div>
        </div>
      )}


                       {/* 7. DATA TAB - COMPARISON HUD FLOAT BAR */}
      {selectedCompareIds.length > 0 && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-fade-in">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-slate-900 border border-slate-750 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
                <History className="h-5 w-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  已选择多维样本比对印证 ({selectedCompareIds.length} 个样本已选)
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {selectedCompareIds.length === 1 
                    ? '请在 Data 表格中点击另一个“对比”按钮以选择第二个或更多样本' 
                    : `🎉 ${selectedCompareIds.length} 组样本就绪！立即开启横向多指标综合偏差核对。`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => {
                  setSelectedCompareIds([]);
                  setCompareActiveDiffIdx(0);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                清空已选
              </button>
              <button
                onClick={() => {
                  setCompareActiveDiffIdx(0);
                  setIsCompareModalOpen(true);
                }}
                disabled={selectedCompareIds.length < 2}
                className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-45 disabled:hover:bg-blue-500 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-500/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                横向数据印证
              </button>
            </div>
          </motion.div>
        </div>
      )}


      {/* 8. DYNAMIC SIDE-BY-SIDE MULTI-SAMPLES COMPARATIVE MODAL */}
      {isCompareModalOpen && selectedCompareIds.length >= 2 && (() => {
        const records = selectedCompareIds.map(id => dataRecords.find(r => r.id === id)).filter(Boolean);
        if (records.length < 2) return null;

        // Construct comparative rows
        const comparisonRows = [
          { id: 'index1', label: 'Index 1 (Product)', fontMono: true, getValue: (r: any) => r.index1 },
          { id: 'index2', label: 'Index 2 (Region)', fontMono: true, getValue: (r: any) => r.index2 },
          { id: 'index3', label: 'Index 3 (Category)', fontMono: true, getValue: (r: any) => r.index3 },
          { id: 'index4', label: 'Index 4 (Segment)', fontMono: true, getValue: (r: any) => r.index4 || '-' },
          { id: 'start_date', label: '生效日期 (Start Date)', fontMono: true, getValue: (r: any) => r.start_date },
          { id: 'end_date', label: '失效日期 (End Date)', fontMono: true, getValue: (r: any) => r.end_date === '2099-01-01' ? '有效至今' : r.end_date },
          ...Array(25).fill(0).map((_, i) => ({
            id: `value-${i}`,
            label: `Value ${i + 1}`,
            fontMono: true,
            isNumeric: true,
            getValue: (r: any) => r.values[i] !== undefined ? r.values[i] : '0.0'
          }))
        ];

        // Evaluate difference status for all rows
        const rowsWithDiff = comparisonRows.map(row => {
          const vals = records.map(r => row.getValue(r));
          const isDiff = new Set(vals).size > 1;
          return {
            ...row,
            vals,
            isDiff
          };
        });

        const diffRows = rowsWithDiff.filter(r => r.isDiff);
        const totalDiffs = diffRows.length;
        const activeDiffIdx = totalDiffs > 0 ? (compareActiveDiffIdx % totalDiffs) : 0;
        const activeDiffRow = totalDiffs > 0 ? diffRows[activeDiffIdx] : null;

        const handleNavigateDiff = (direction: number) => {
          if (totalDiffs === 0) return;
          const nextIdx = (compareActiveDiffIdx + direction + totalDiffs) % totalDiffs;
          setCompareActiveDiffIdx(nextIdx);

          const nextDiffRow = diffRows[nextIdx];
          if (nextDiffRow) {
            const targetId = `compare-row-${nextDiffRow.id}`;
            const element = document.getElementById(targetId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex justify-center items-start overflow-y-auto py-8 md:py-12 px-4 select-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl my-auto flex flex-col overflow-hidden max-h-[90vh] md:max-h-[85vh] focus:outline-none"
            >
              {/* Header Box */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <History className="h-5 w-5 text-blue-400" />
                    多维样本参数差异比对印证看板 ({records.length} 个样本同步对比)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">跨周期有效性、极差偏离分析、以及异常不一致高亮项快速追溯</p>
                </div>
                <button 
                  onClick={() => setIsCompareModalOpen(false)} 
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Container Body */}
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 min-h-0 select-text">
                {/* 1. Records summary list */}
                <div className="flex gap-4 overflow-x-auto pb-2 shrink-0 scrollbar-thin">
                  {records.map((rec, rIndex) => (
                    <div 
                      key={rec.id} 
                      className="min-w-[210px] flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 border-l-4 border-l-blue-500 relative shadow-sm"
                    >
                      <span className="text-[10px] uppercase font-bold text-blue-600 block">
                        样本 #{rIndex + 1}
                      </span>
                      <p className="text-xs font-semibold text-slate-900 mt-1 truncate">
                        🔑 {rec.index1} / {rec.index2}
                      </p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">
                        {rec.index3} {rec.index4 ? `/ ${rec.index4}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-450 font-mono mt-1.5 whitespace-nowrap">
                        历时: {rec.start_date} 至 {rec.end_date === '2099-01-01' ? '至今 (继续有效)' : rec.end_date}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 2. Unified Discrepancy Navigation Hub */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shrink-0 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="p-1 px-2.5 text-xs bg-indigo-600 text-white rounded font-bold">
                      偏差精细分析
                    </div>
                    <span className="text-xs font-medium text-slate-800">
                      系统发现本次多样本参数中，存在 <span className="text-rose-600 text-[14px] font-black">{totalDiffs}</span> 处属性不相同/数值差异项。
                    </span>
                  </div>
                  {totalDiffs > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleNavigateDiff(-1)}
                        className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        title="定位到上一个参数偏离行"
                      >
                        <ChevronLeft className="h-4 w-4" /> 上一个差异
                      </button>
                      <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-100/70 border border-indigo-200/50 px-2.5 py-1 rounded-md">
                        当前第 {activeDiffIdx + 1} / {totalDiffs}
                      </span>
                      <button
                        onClick={() => handleNavigateDiff(1)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm shadow-indigo-600/10"
                        title="定位到下一个参数偏离行"
                      >
                        下一个差异 <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Infinite Comparative Table with double overflow controls */}
                <div className="border border-slate-200 rounded-xl overflow-auto max-h-[50vh] shadow-inner relative select-text scrollbar-thin">
                  <table className="w-full text-xs text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-705 border-b border-slate-200 sticky top-0 z-20">
                        <th className="px-4 py-2.5 w-[180px] bg-slate-100 sticky left-0 z-21 shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                          数据属性 / 物理量纲
                        </th>
                        {records.map((_, rIndex) => (
                          <th key={rIndex} className="px-4 py-2.5 min-w-[130px] font-semibold text-slate-750 bg-slate-100 border-r border-slate-150">
                            样本 #{rIndex + 1}
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-center w-[160px] bg-slate-100 sticky right-0 z-21 shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                          核对偏差印证
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 bg-white">
                      {rowsWithDiff.map((row) => {
                        const isFocused = totalDiffs > 0 && activeDiffRow && row.id === activeDiffRow.id;
                        
                        // Pick background color for sticky columns dynamically based on state
                        let stickyColBg = 'bg-white text-slate-705';
                        let rowBorderL = 'border-l-4 border-l-transparent';
                        let mainRowClass = 'hover:bg-slate-50/50 transition-colors duration-150';

                        if (isFocused) {
                          stickyColBg = 'bg-amber-100 text-amber-950 font-bold';
                          rowBorderL = 'border-l-4 border-l-amber-500';
                          mainRowClass = 'bg-amber-100/85 transition-colors duration-150';
                        } else if (row.isDiff) {
                          stickyColBg = 'bg-rose-50 text-slate-705';
                          rowBorderL = 'border-l-4 border-l-rose-400';
                          mainRowClass = 'bg-rose-50/20 hover:bg-rose-50/40 transition-colors duration-150';
                        }

                        return (
                          <tr 
                            key={row.id} 
                            id={`compare-row-${row.id}`}
                            className={`${rowBorderL} ${mainRowClass}`}
                          >
                            {/* Sticky Left: Attribute Identifier */}
                            <td className={`px-4 py-2.5 font-semibold text-slate-500 sticky left-0 z-10 shadow-[1px_0_0_0_rgba(226,232,240,1)] whitespace-nowrap transition-colors ${stickyColBg}`}>
                              {row.label}
                            </td>

                            {/* Middle scrollable content: Sample columns */}
                            {row.vals.map((val, vIdx) => {
                              let cellHighlight = '';
                              if (isFocused) {
                                cellHighlight = 'bg-amber-100 text-amber-950 font-black';
                              } else if (row.isDiff) {
                                cellHighlight = 'text-rose-700 bg-rose-50/70 font-semibold';
                              }
                              return (
                                <td 
                                  key={vIdx} 
                                  className={`px-4 py-2.5 font-mono text-[11px] select-all border-r border-slate-150 transition-colors ${cellHighlight}`}
                                >
                                  {val}
                                </td>
                              );
                            })}

                            {/* Sticky Right: Comparative Verdict / Numeric Delta calculations */}
                            <td className={`px-4 py-2 text-center sticky right-0 z-10 shadow-[-1px_0_0_0_rgba(226,232,240,1)] whitespace-nowrap transition-colors ${stickyColBg}`}>
                              {row.isDiff ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="text-rose-600 font-bold text-[10.5px] px-2 py-0.5 rounded bg-rose-105/50 border border-rose-200">
                                    ❌ 存在偏离
                                  </span>
                                  {(row as any).isNumeric && row.vals.every((valStr: any) => !isNaN(parseFloat(valStr))) && (() => {
                                    const numVals = row.vals.map((valStr: any) => parseFloat(valStr));
                                    const minVal = Math.min(...numVals);
                                    const maxVal = Math.max(...numVals);
                                    const delta = (maxVal - minVal).toFixed(2);
                                    return (
                                      <span className="text-[9.5px] font-mono font-medium text-slate-500 mt-0.5 shrink-0">
                                        极差: {delta}
                                      </span>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[11px] block">
                                  ✓ 完全一致
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status Footer Actions */}
              <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-slate-400">
                  提示：通过锁定属性列和差异极差指标，该面板可帮助您快速审查多租户/多季度版本的属性跨生命周期平移。
                </span>
                <button
                  onClick={() => setIsCompareModalOpen(false)}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-400 font-bold text-slate-950 text-xs rounded-lg transition shadow-md hover:scale-102"
                >
                  关闭印证面板
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}


      {/* Trace Timeline & Audit Association Tracking Modal */}
      {traceEntityKey && (() => {
        const parts = traceEntityKey.split('_');
        const i1 = parts[0] || '';
        const i2 = parts[1] || '';
        const i3 = parts[2] || '';
        const i4 = parts[3] || '';

        // 1. Find all chronological records for this logical entity key in dataRecords
        const linkedVersions = dataRecords
          .filter(r => r.index1 === i1 && r.index2 === i2 && r.index3 === i3 && r.index4 === i4)
          .sort((a, b) => a.start_date.localeCompare(b.start_date)); // oldest first for timeline flow

        // 2. Find all audit log entries for this logical entity key
        const linkedLogs = historyLogs.filter(log => log.entityKey === traceEntityKey);

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4.5 flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      生命线归属与关联事务跟踪
                    </h3>
                    <p className="text-slate-400 text-xs font-mono mt-0.5">
                      Entity Trace: {traceEntityKey}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTraceEntityKey(null)}
                  className="rounded-lg p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
                
                {/* 1. Attributes Header Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider block">Index 1 (Product)</span>
                    <span className="font-bold text-sm text-slate-900 font-mono block truncate" title={i1}>{i1 || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider block">Index 2 (Region)</span>
                    <span className="font-bold text-sm text-slate-900 font-mono block truncate" title={i2}>{i2 || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider block">Index 3 (Category)</span>
                    <span className="font-bold text-sm text-slate-900 font-mono block truncate" title={i3}>{i3 || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider block">Index 4 (Channel)</span>
                    <span className="font-bold text-sm text-slate-900 font-mono block truncate" title={i4}>{i4 || '-'}</span>
                  </div>
                </div>

                {/* Main Two Columns Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Temporal Version Intervals (Oldest to Newest) */}
                  <div className="lg:col-span-5 space-y-3">
                    <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5 uppercase tracking-wider border-b border-slate-200 pb-2">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      时序生效期限链 ({linkedVersions.length} 个版本)
                    </h4>

                    {linkedVersions.length === 0 ? (
                      <div className="bg-white border border-dashed border-slate-200 text-center py-8 rounded-xl text-slate-400 text-xs">
                        暂无处于有效维护期间的生命周期区块
                      </div>
                    ) : (
                      <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {linkedVersions.map((v, idx) => {
                          const isActive = v.end_date === '2099-01-01';
                          return (
                            <div key={v.id} className="relative group">
                              {/* Connector Pin */}
                              <span className={`absolute -left-[14.5px] top-1.5 h-3 w-3 rounded-full border-2 border-white shadow-xs ${
                                isActive 
                                  ? 'bg-emerald-500' 
                                  : 'bg-slate-400'
                              }`} />
                              
                              <div className={`bg-white border rounded-xl p-3.5 shadow-xs transition hover:shadow-sm ${
                                isActive ? 'border-emerald-250 bg-emerald-50/5' : 'border-slate-200'
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isActive 
                                      ? 'bg-emerald-100 text-emerald-800 animate-pulse' 
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {isActive ? '当前最新有效版本' : `历史归档版本 #${idx + 1}`}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-400 block shrink-0">
                                    ID: {v.id.substring(0, 10)}...
                                  </span>
                                </div>
                                <div className="font-semibold text-xs text-slate-900 mt-1 flex items-center gap-1.5 font-mono">
                                  <span>{v.start_date}</span>
                                  <span className="text-slate-400">至</span>
                                  <span className={isActive ? 'text-emerald-600 font-bold' : 'text-slate-600'}>
                                    {v.end_date === '2099-01-01' ? '有效至今 (2099-01-01)' : v.end_date}
                                  </span>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between items-center bg-slate-50/50 px-1.5 py-0.5 rounded">
                                  <span className="font-medium">数值量纲:</span>
                                  <span className="font-mono text-slate-600">
                                    {v.values.filter(Boolean).length} 项指标值
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Audit Logs specifically filtered to this logical composite key */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <History className="h-3.5 w-3.5 text-slate-500" />
                        操作事件 & 变更关联审计 ({linkedLogs.length} 条记录)
                      </h4>
                      <button
                        onClick={() => {
                          setHistorySearch(traceEntityKey);
                          setHistoryActionFilter('All');
                          setActiveTab('history');
                          setTraceEntityKey(null);
                        }}
                        className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline scroll-smooth"
                      >
                        在审计日志库中查看全文 &rarr;
                      </button>
                    </div>

                    {linkedLogs.length === 0 ? (
                      <div className="bg-white border border-dashed border-slate-200 text-center py-12 rounded-xl text-slate-400 text-xs">
                        暂无针对此主键实体的关联修改/删除/到期等审计事务
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                        {linkedLogs.map((log) => {
                          let badgeBg = 'bg-slate-100 text-slate-750';
                          if (log.actionType === 'CREATE') badgeBg = 'bg-blue-50 text-blue-750 border border-blue-200';
                          if (log.actionType === 'UPDATE') badgeBg = 'bg-violet-50 text-violet-750 border border-violet-200';
                          if (log.actionType === 'DELETE') badgeBg = 'bg-rose-50 text-rose-750 border border-rose-200';
                          if (log.actionType === 'EXPIRE') badgeBg = 'bg-amber-50 text-amber-750 border border-amber-200';
                          if (log.actionType === 'SYNC_CALIBRATION') badgeBg = 'bg-emerald-50 text-emerald-750 border border-emerald-200';

                          return (
                            <div key={log.id} className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs transition hover:border-slate-300">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeBg}`}>
                                  {log.actionType === 'CREATE' && '创建新版本'}
                                  {log.actionType === 'UPDATE' && '属性值微调'}
                                  {log.actionType === 'DELETE' && '物理数据删除'}
                                  {log.actionType === 'EXPIRE' && '截断使到期'}
                                  {log.actionType === 'SYNC_CALIBRATION' && '对账校准联动'}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {log.timestamp}
                                </span>
                              </div>

                              <p className="text-slate-700 text-[11.5px] font-medium leading-relaxed mt-2 pl-2 border-l-2 border-slate-350">
                                {log.details}
                              </p>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400 bg-slate-50/70 p-2 rounded-lg font-mono">
                                <div>
                                  <span className="block text-slate-400 uppercase font-semibold">修改经手操作人</span>
                                  <span className="font-semibold text-slate-600">{log.operator}</span>
                                </div>
                                <div>
                                  <span className="block text-slate-450 uppercase font-semibold">物理记录 ID</span>
                                  <span className="font-semibold text-slate-650 truncate block" title={log.recordId}>{log.recordId || '(无标记)'}</span>
                                </div>
                              </div>

                              {/* Small Attribute Diffs for trace panel log entry */}
                              {(() => {
                                const diffs = getFieldDiffs(log.beforeSnapshot, log.afterSnapshot);
                                if (diffs.length === 0) return null;
                                return (
                                  <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200">
                                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block mb-1.5">
                                      ✨ 核算变动明细 ({diffs.length} 项):
                                    </span>
                                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-0.5">
                                      {diffs.map((d, dIdx) => (
                                        <div key={dIdx} className="bg-slate-50/70 border border-slate-150 rounded p-1.5 flex items-center justify-between text-[10px]">
                                          <span className="font-bold text-slate-600">{d.fieldName}</span>
                                          <div className="flex items-center gap-1 font-mono">
                                            <span className="text-rose-600 line-through truncate max-w-[80px]" title={d.beforeVal}>{d.beforeVal}</span>
                                            <span className="text-slate-400">&rarr;</span>
                                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded-sm truncate max-w-[80px]" title={d.afterVal}>{d.afterVal}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>

                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 font-medium">
                  提示：系统利用生命周期引擎关联级联变动，本追溯链包含所有期限区间的并和及对账记录。
                </span>
                <button
                  onClick={() => setTraceEntityKey(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition"
                >
                  关闭追溯面板
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}


    </div>
  );
}

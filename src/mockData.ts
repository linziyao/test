import { DataRecord, CheckRecord, DragColumn } from './types';

// Helper to format date
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Generate high quality mock data
export function generateInitialData(): { dataRecords: DataRecord[], checkRecords: CheckRecord[] } {
  const dataRecords: DataRecord[] = [];
  
  const regions = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'];
  const categories = ['CORP', 'RETAIL', 'SMB', 'GOV', 'INST'];
  const channels = ['DIRECT', 'PARTNER', 'ONLINE', 'AGENT'];
  
  let recordIdCounter = 1;

  // Let's generate 120 unique index entities.
  // We will make some of them have historical versions (effective interval data)
  for (let i = 1; i <= 120; i++) {
    const productCode = `PRD-${1000 + i}`;
    const region = regions[i % regions.length];
    const category = categories[i % categories.length];
    const channel = channels[i % channels.length];

    // Generate 25 premium mock parameters (mix of rates, costs, factors, targets)
    const generateValues = (seed: number) => {
      const v: string[] = [];
      for (let k = 1; k <= 25; k++) {
        if (k % 5 === 0) {
          // A percentage multiplier like 1.25
          v.push(((seed * k * 0.17) % 3 + 0.5).toFixed(2));
        } else if (k % 4 === 0) {
          // A status or region tier flag
          v.push(`TIER-${(seed + k) % 4 + 1}`);
        } else if (k % 3 === 0) {
          // An integer count or threshold
          v.push(String(((seed * k + 45) % 800) + 100));
        } else {
          // An active price or coefficient
          v.push(((seed * k * 12.3) % 900 + 45).toFixed(1));
        }
      }
      return v;
    };

    // 1. For some products, let's create a historical record (expired)
    // and a current active record (end_date = 2099-01-01)
    if (i % 4 === 0) {
      // Historical version: 2025-01-01 to 2025-12-31
      dataRecords.push({
        id: `D-${recordIdCounter++}`,
        index1: productCode,
        index2: region,
        index3: category,
        index4: channel,
        values: generateValues(i * 10),
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });

      // Active version: 2026-01-01 to 2099-01-01
      dataRecords.push({
        id: `D-${recordIdCounter++}`,
        index1: productCode,
        index2: region,
        index3: category,
        index4: channel,
        values: generateValues(i),
        start_date: '2026-01-01',
        end_date: '2099-01-01'
      });
    } else {
      // Normal active from 2026-01-01 to 2099-01-01
      dataRecords.push({
        id: `D-${recordIdCounter++}`,
        index1: productCode,
        index2: region,
        index3: category,
        index4: channel,
        values: generateValues(i),
        start_date: '2026-01-01',
        end_date: '2099-01-01'
      });
    }
  }

  // Now, let's generate some mock "External Out System" records for June 2026 reconciliation
  // We'll simulate 110 records from the external system.
  // To create discrepancy:
  // - 80 will perfectly match the active Data records (Match)
  // - 15 will have Value Mismatches (e.g. external data has edited values in value2 or value8, etc.)
  // - 5 will only exist in active Data records list but NOT in Out system (OnlyInData)
  // - 10 will only exist in external data, but NOT in Data page (OnlyInOut)
  
  const checkRecords: CheckRecord[] = [];
  const currentActiveData = dataRecords.filter(r => r.end_date === '2099-01-01');
  
  let checkIdCounter = 1;
  const targetMonth = '2026-06';

  // 1. Matches (80 items)
  for (let idx = 0; idx < Math.min(80, currentActiveData.length); idx++) {
    const parent = currentActiveData[idx];
    
    // Add the internal active record snapshot
    checkRecords.push({
      id: `C-DATA-${checkIdCounter}`,
      check_month: targetMonth,
      index1: parent.index1,
      index2: parent.index2,
      index3: parent.index3,
      index4: parent.index4,
      values: [...parent.values],
      source_system: 'Data',
      compare_result: 'Match',
      source: 'system',
      db_values: [...parent.values],
      out_values: [...parent.values],
      diff_indices: [],
      linked_data_id: parent.id
    });

    // Add the corresponding external record snapshot
    checkRecords.push({
      id: `C-OUT-${checkIdCounter++}`,
      check_month: targetMonth,
      index1: parent.index1,
      index2: parent.index2,
      index3: parent.index3,
      index4: parent.index4,
      values: [...parent.values],
      source_system: 'Out',
      compare_result: 'Match',
      source: 'system',
      db_values: [...parent.values],
      out_values: [...parent.values],
      diff_indices: [],
      linked_data_id: parent.id
    });
  }

  // 2. Value Mismatches (15 items)
  for (let idx = 80; idx < Math.min(95, currentActiveData.length); idx++) {
    const parent = currentActiveData[idx];
    
    // Modify some values for the external system's version
    const extValues = [...parent.values];
    const diffIndices: number[] = [];
    
    // Create difference at index 2, 7 or 18
    if (idx % 3 === 0) {
      extValues[2] = (parseFloat(extValues[2]) + 10.5).toFixed(1);
      diffIndices.push(2);
    } else if (idx % 3 === 1) {
      extValues[7] = `${extValues[7]}_EDITED`;
      diffIndices.push(7);
    } else {
      extValues[18] = String(Number(extValues[18]) - 15);
      diffIndices.push(18);
    }

    // Add the internal representation in Check Page
    checkRecords.push({
      id: `C-DATA-${checkIdCounter}`,
      check_month: targetMonth,
      index1: parent.index1,
      index2: parent.index2,
      index3: parent.index3,
      index4: parent.index4,
      values: [...parent.values],
      source_system: 'Data',
      compare_result: 'Mismatch',
      source: 'system',
      db_values: [...parent.values],
      out_values: extValues,
      diff_indices: diffIndices,
      linked_data_id: parent.id
    });

    // Add the external Out system representation in Check Page
    checkRecords.push({
      id: `C-OUT-${checkIdCounter++}`,
      check_month: targetMonth,
      index1: parent.index1,
      index2: parent.index2,
      index3: parent.index3,
      index4: parent.index4,
      values: extValues,
      source_system: 'Out',
      compare_result: 'Mismatch',
      source: 'system',
      db_values: [...parent.values],
      out_values: extValues,
      diff_indices: diffIndices,
      linked_data_id: parent.id
    });
  }

  // 3. Only in Data (5 items)
  for (let idx = 95; idx < Math.min(100, currentActiveData.length); idx++) {
    const parent = currentActiveData[idx];
    
    checkRecords.push({
      id: `C-DATA-${checkIdCounter++}`,
      check_month: targetMonth,
      index1: parent.index1,
      index2: parent.index2,
      index3: parent.index3,
      index4: parent.index4,
      values: [...parent.values],
      source_system: 'Data',
      compare_result: 'OnlyInData',
      source: 'system',
      db_values: [...parent.values],
      out_values: [],
      diff_indices: [],
      linked_data_id: parent.id
    });
  }

  // 4. Only in Out (10 items) - entirely new items that don't exist in our Data yet
  for (let k = 1; k <= 10; k++) {
    const pCode = `PRD-EXTERNAL-${2000 + k}`;
    const region = regions[k % regions.length];
    const category = categories[k % categories.length];
    const channel = channels[k % channels.length];

    const generateExternalNewValues = () => {
      const v: string[] = [];
      for (let j = 1; j <= 25; j++) {
        v.push((j * 3.5 + k * 1.5).toFixed(1));
      }
      return v;
    };

    const extValues = generateExternalNewValues();

    checkRecords.push({
      id: `C-OUT-${checkIdCounter++}`,
      check_month: targetMonth,
      index1: pCode,
      index2: region,
      index3: category,
      index4: channel,
      values: extValues,
      source_system: 'Out',
      compare_result: 'OnlyInOut',
      source: 'system',
      db_values: [],
      out_values: extValues,
      diff_indices: []
    });
  }

  return { dataRecords, checkRecords };
}

// Default columns definitions
export function getDefaultDataColumns(): DragColumn[] {
  const cols: DragColumn[] = [
    { id: 'index1', label: 'Index 1 (Product)', isIndex: true, width: 140 },
    { id: 'index2', label: 'Index 2 (Region)', isIndex: true, width: 120 },
    { id: 'index3', label: 'Index 3 (Category)', isIndex: true, width: 120 },
    { id: 'index4', label: 'Index 4 (Channel)', isIndex: true, width: 120 },
    { id: 'start_date', label: '生效期 (Start Date)', width: 140 },
    { id: 'end_date', label: '失效期 (End Date)', width: 140 },
  ];

  // Append 25 value columns
  for (let i = 1; i <= 25; i++) {
    cols.push({
      id: `value${i}`,
      label: `Value ${i}`,
      isValue: true,
      valueIdx: i - 1,
      width: 100
    });
  }

  return cols;
}

export function getDefaultCheckColumns(): DragColumn[] {
  const cols: DragColumn[] = [
    { id: 'source_system', label: '来源系统 (Source)', width: 120 },
    { id: 'compare_result', label: '比对结果 (Result)', width: 140 },
    { id: 'source', label: '生成方式 (Type)', width: 110 },
    { id: 'index1', label: 'Index 1 (Product)', isIndex: true, width: 140 },
    { id: 'index2', label: 'Index 2 (Region)', isIndex: true, width: 125 },
    { id: 'index3', label: 'Index 3 (Category)', isIndex: true, width: 125 },
    { id: 'index4', label: 'Index 4 (Channel)', isIndex: true, width: 125 },
  ];

  for (let i = 1; i <= 25; i++) {
    cols.push({
      id: `value${i}`,
      label: `Value ${i}`,
      isValue: true,
      valueIdx: i - 1,
      width: 100
    });
  }

  return cols;
}

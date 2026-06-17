export interface DataRecord {
  id: string;
  index1: string;
  index2: string;
  index3: string;
  index4: string;
  values: string[]; // Length 25 representing value1 to value25
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD (2099-01-01 represents active)
}

export type CompareResult = 'Match' | 'Mismatch' | 'OnlyInData' | 'OnlyInOut';
export type SourceSystemType = 'Data' | 'Out';
export type SourceOption = 'system' | 'manual';

export interface CheckRecord {
  id: string;
  check_month: string; // YYYY-MM
  index1: string;
  index2: string;
  index3: string;
  index4: string;
  values: string[]; // Length 25 representing value1 to value25
  source_system: SourceSystemType;
  compare_result: CompareResult;
  source: SourceOption;

  // To show comparison details easily
  db_values?: string[]; // Values from Data page if compared
  out_values?: string[]; // Values from Out system if compared
  diff_indices?: number[]; // list of value indices (0-24) that differ
  linked_data_id?: string; // Reference to the original live Data record (end_date=2099-01-01)
  has_been_synced?: boolean; // Flag to show if user已将更改同步/处理完毕
}

export interface DragColumn {
  id: string;
  label: string;
  isIndex?: boolean;
  isValue?: boolean;
  valueIdx?: number;
  width?: number;
}

export interface HistoryLog {
  id: string;
  timestamp: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPIRE' | 'SYNC_CALIBRATION';
  operator: string;
  entityKey: string;
  index1: string;
  index2: string;
  index3: string;
  index4: string;
  recordId: string;
  details: string;
  beforeSnapshot?: Partial<DataRecord>;
  afterSnapshot?: Partial<DataRecord>;
}

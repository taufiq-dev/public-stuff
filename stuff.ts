function analyzeTierStructure(data: any): {
  tierCount: number;
  tierNames: string[];
  originalTierNames: string[];
  structure: string;
  transformedData: any;
} {
  const originalTierNames: string[] = [];
  let current = data;

  // First, collect all the original tier names
  while (current && typeof current === 'object') {
    const listProperties = Object.keys(current).filter(key => key.endsWith('List'));

    if (listProperties.length === 0) {
      break;
    }

    const listProp = listProperties[0];
    const tierName = listProp.replace('List', ''); // Remove "List" suffix
    originalTierNames.push(tierName);

    const listValue = current[listProp];
    const firstItem = Array.isArray(listValue) ? listValue[0] : listValue;

    if (!firstItem || typeof firstItem !== 'object' || !('Label' in firstItem)) {
      break;
    }

    current = firstItem;
  }

  // Create tier names: Tier1, Tier2, ..., Branches
  const tierNames = originalTierNames.map((name, index) => {
    if (index === originalTierNames.length - 1) {
      return 'Branches'; // Always keep the last one as "Branches"
    }
    return `Tier${index + 1}`;
  });

  // Transform the data with new key names
  const transformedData = transformTierKeys(data, originalTierNames);

  return {
    tierCount: originalTierNames.length - 1, // Exclude branches from tier count
    tierNames,
    originalTierNames,
    structure: tierNames.join(' → '),
    transformedData
  };
}

// Function to transform the data keys from original names to Tier1_List, Tier2_List, etc.
function transformTierKeys(data: any, originalTierNames: string[]): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => transformTierKeys(item, originalTierNames));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(data)) {
    let newKey = key;

    // Check if this key is a tier list that needs transformation
    if (key.endsWith('List')) {
      const tierName = key.replace('List', '');
      const tierIndex = originalTierNames.indexOf(tierName);

      if (tierIndex !== -1) {
        if (tierIndex === originalTierNames.length - 1) {
          // Keep BranchesList as is
          newKey = 'BranchesList';
        } else {
          // Transform to Tier1_List, Tier2_List, etc.
          newKey = `Tier${tierIndex + 1}_List`;
        }
      }
    }

    // Recursively transform the value
    result[newKey] = transformTierKeys(value, originalTierNames);
  }

  return result;
}
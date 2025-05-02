export const fetchSpotPrice = async () => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd&include_24hr_change=true');
    if (!response.ok) {
      throw new Error('Failed to fetch spot price');
    }
    const data = await response.json();
    return {
      price: data.tether.vnd,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error fetching spot price:', error);
    throw error;
  }
};

export const fetchP2PData = async (tradeType = 'BUY') => {
  try {
    const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fiat: "VND",
        page: 1,
        rows: 20,
        payTypes: [],
        asset: "USDT",
        tradeType: tradeType,
        transAmount: "",
        order: "",
        filterType: "all"
      })
    });
    
    if (!response.ok) {
      console.error('Failed to fetch P2P data, status:', response.status);
      return [];
    }
    
    const data = await response.json();
    if (!data || !data.data || !Array.isArray(data.data)) {
      console.error('Invalid P2P data format:', data);
      return [];
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching P2P data:', error);
    return []; // Return empty array on error
  }
}; 
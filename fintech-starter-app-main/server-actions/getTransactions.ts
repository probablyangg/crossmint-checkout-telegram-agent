"use server";

import { getCoinbaseJWT } from "@/utils/coinbase";

export async function getTransactions(userId: string) {
  if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
    return [];
  }
  const url = "api.developer.coinbase.com";
  const method = "GET";
  const request_path = `/onramp/v1/sell/user/${userId}/transactions`;
  const jwt = await getCoinbaseJWT(url, method, request_path);

  try {
    // Send the request
    const response = await fetch(`https://${url}${request_path}`, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });
    const { transactions } = await response.json();
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);
  }
}

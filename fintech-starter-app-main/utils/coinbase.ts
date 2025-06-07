import base64url from "base64url";
import _sodium from "libsodium-wrappers";
import crypto from "crypto";

export const getCoinbaseJWT = async (url: string, method: string, request_path: string) => {
  const key_name = process.env.COINBASE_API_KEY_ID!;
  const key_secret = process.env.COINBASE_API_KEY_SECRET!;
  const uri = method + " " + url + request_path;

  await _sodium.ready;
  const sodium = _sodium;
  const privateKey = key_secret;
  const payload = {
    iss: "cdp",
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120,
    sub: key_name,
    uri,
  };
  const { headerAndPayloadBase64URL, keyBuf } = encode(payload, privateKey, "EdDSA", key_name);
  const signature = sodium.crypto_sign_detached(headerAndPayloadBase64URL, keyBuf);
  const signatureBase64url = base64url(Buffer.from(signature));
  return `${headerAndPayloadBase64URL}.${signatureBase64url}`;
};

const encode = (payload: any, key: any, alg: any, key_name: string) => {
  const header = {
    typ: "JWT",
    alg,
    kid: key_name,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const headerBase64URL = base64url(JSON.stringify(header));
  const payloadBase64URL = base64url(JSON.stringify(payload));
  const headerAndPayloadBase64URL = `${headerBase64URL}.${payloadBase64URL}`;
  const keyBuf = Buffer.from(key, "base64");
  return { headerAndPayloadBase64URL, keyBuf };
};

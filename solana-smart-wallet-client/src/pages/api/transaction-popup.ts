import { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from './auth/[...nextauth]';
import { getServerSession } from 'next-auth';
import { Connection, PublicKey } from '@solana/web3.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const {destWallet, amount } = req.query;
    //@ts-ignore
    const session = await getServerSession(req, res, authOptions)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
        // Construct the callback URL
        const callbackUrl = `${protocol}://${req.headers.host}${req.url}`;
    if (!session) {
        
        const signInUrl = `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

        // Redirect to the Google login page with the callback URL
        return res.redirect(signInUrl);
    }

    const resp = await (await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/wallet/${session.user?.email}`)).json()

    if(resp.success===true){
        const connection = new Connection('https://api.devnet.solana.com');
        const balance = await connection.getBalance(new PublicKey(resp.wallet))
        const solBalance = parseFloat((balance*0.000000001).toFixed(7)).toString()
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sign Transaction</title>
                <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #121212;
            color: #e0e0e0;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            background-color: #1e1e1e;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 0px 15px rgba(0, 0, 0, 0.5);
            max-width: 350px;
            width: 100%;
            text-align: center;
        }
        h1 {
            color: #bb86fc;
            font-size: 24px;
            margin-bottom: 15px;
        }
        h2, h3 {
            font-size: 16px;
            color: #bdbdbd;
            margin-bottom: 8px;
        }
        p {
            font-size: 13px;
            color: #a0a0a0;
            margin: 8px 0;
        }
        button {
            background-color: #d150eb;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 15px;
            margin-bottom: 8px;
            width: 100%;
            transition: background-color 0.3s ease;
        }
        button:hover {
            background-color: #3700b3;
        }
        #logout-btn {
            background-color: #cf6679;
        }
        #logout-btn:hover {
            background-color: #b00020;
        }
    </style>
            </head>
            <body>
                <div class="container">
                    <h1>Sign Transaction</h1>
                    <h2 id="wallet-address"></h2>
                    <h3>SOL Balance: ${solBalance} SOL</h3>
                    <p><strong>From:</strong> ${session.user?.email}</p>
                    <p><strong>To:</strong> ${destWallet}</p>
                    <p><strong>Amount:</strong> ${amount} lamports</p>
                    <button id="sign-btn">Sign and Send</button>
                    <button id="logout-btn">Logout</button> <!-- Logout button -->
                 </div>
    
                <script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.js"> </script>
                <script>

                     function maskWallet(wallet) {
                        if (wallet.length <= 12) {
                            return wallet; // No need to mask if the wallet is too short
                        }
                        const start = wallet.slice(0, 5);
                        const end = wallet.slice(-5);
                        return start + '****' + end;
                    }
                    document.getElementById('wallet-address').innerText = 'Wallet Address: ' + maskWallet("${resp.wallet}");
                    const email = "${session.user?.email}";
                    const destWallet = "${destWallet}";
                    const amount = ${amount};
                    const backendUrl = "${process.env.NEXT_PUBLIC_BACKEND_URI}";
                    const programId = "${process.env.NEXT_PUBLIC_PROGRAM_ID}";
                    const payerWallet = "${process.env.NEXT_PUBLIC_PAYER_WALLET}";
                    
                    function base64ToUint8Array(base64) {
                    const binaryString = atob(base64); // Decode base64 string
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    return bytes;
                }
                    const connection = new solanaWeb3.Connection('https://api.devnet.solana.com');
    
                    document.getElementById('sign-btn').addEventListener('click', async () => {
                        try {
                            // Fetch shard2 in the client-side pop-up, where the session is available
                            const shard2Response = await fetch('/api/retrieve');
    
                            if (shard2Response.status !== 200) throw new Error('Failed to retrieve shard2');
                            const { retrievedPasskey } = await shard2Response.json();
                            console.log(retrievedPasskey)
                            const shard2 = base64ToUint8Array(retrievedPasskey);
    
                            // Fetch shard1 from your backend
                            const shard1Response = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URI}/shard1/${session.user?.email}");
                            if (shard1Response.status !== 200) throw new Error('Failed to retrieve shard1');
                            const { shard1, walletAddress } = await shard1Response.json();
                            const shard1Array = base64ToUint8Array(shard1);
                            
                            const privateKey = new Uint8Array([...shard1Array, ...shard2]);
                            const wallet = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(privateKey));
                            const pda = new solanaWeb3.PublicKey(walletAddress);
                            const destWalletPubKey = new solanaWeb3.PublicKey(destWallet);
    
                            // Create the transaction
                            const transaction = new solanaWeb3.Transaction().add({
                                keys: [
                                    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
                                    { pubkey: pda, isSigner: false, isWritable: true },
                                    { pubkey: destWalletPubKey, isSigner: false, isWritable: true },
                                    { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
                                ],
                                programId: new solanaWeb3.PublicKey(programId),
                                data: new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer),
                            });
    
                            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                            transaction.feePayer = new solanaWeb3.PublicKey(payerWallet);
                            transaction.partialSign(wallet);
    
                            // Send the transaction to the backend for final signing
                            const transactionBase64 = transaction.serialize({ requireAllSignatures: false }).toString('base64');
                            const response = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URI}/sign-and-send", {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ transaction: transactionBase64 }),
                            });
    
                            const result = await response.json();
    
                            if (response.status === 200) {
                                window.opener.postMessage({ status: 'success', txid: result.txid }, '*');
                            } else {
                                throw new Error(result.error || 'Failed to send transaction');
                            }
                            window.close();
                        } catch (error) {
                            console.error('Transaction failed:', error);
                            window.opener.postMessage({ status: 'error', error: error }, '*');
                            window.close();
                        }
                    });
                    document.getElementById('logout-btn').addEventListener('click', () => {
        const callbackUrl = window.location.origin; // Redirect after logout
        const signoutUrl = '/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}';
        
        // Redirect to the signout URL to properly log out
        window.location.href = signoutUrl;
    })
                </script>
            </body>
            </html>
        `);
    } else{
        return res.status(404).send(
            `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sign Transaction</title>
            </head>
            <body>
                <h2>${session.user?.email}</h2>
                <h1>No wallet found please create your wallet</h1>
            </body>
            </html>`
        )
    }
    
}

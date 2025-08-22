// server.js
import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// Multer setup (memory storage for file buffer)
const upload = multer({ storage: multer.memoryStorage() });

// 🔑 Supabase Credentials
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 📂 Upload helper
async function uploadToSupabase(fileBuffer, fileName, userId, folder) {
  const filePath = `${userId}/${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from("photos") // bucket name
    .upload(filePath, fileBuffer, {
      upsert: true,
      contentType: "image/jpeg", // adjust dynamically if needed
    });

  if (error) throw error;

  // Get public URL
  const { data } = supabase.storage.from("photos").getPublicUrl(filePath);
  return data.publicUrl;
}

//////////////////////////////
// ✅ VENDORS CRUD (with photo upload)
//////////////////////////////

// ✅ Vendors - Create Vendor
app.post(
  "/vendors",
  upload.fields([
    { name: "personal_photo", maxCount: 1 },
    { name: "aadhar_photo", maxCount: 1 },
    { name: "cart_photo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.body.user_id;
      const phone = req.body.phone;

      // 🔍 Check for duplicate phone
      const { data: existingVendor, error: phoneError } = await supabase
        .from("vendors")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (phoneError) return res.status(400).json({ error: phoneError.message });
      if (existingVendor)
        return res
          .status(400)
          .json({ error: "Phone number already exists for another vendor" });

      // 📂 Upload photos
      let photoUrls = {};
      if (req.files.personal_photo) {
        photoUrls.personal_photo = await uploadToSupabase(
          req.files.personal_photo[0].buffer,
          "personal.jpg",
          userId,
          "vendor"
        );
      }
      if (req.files.aadhar_photo) {
        photoUrls.aadhar_photo = await uploadToSupabase(
          req.files.aadhar_photo[0].buffer,
          "aadhar.jpg",
          userId,
          "vendor"
        );
      }
      if (req.files.cart_photo) {
        photoUrls.cart_photo = await uploadToSupabase(
          req.files.cart_photo[0].buffer,
          "cart.jpg",
          userId,
          "vendor"
        );
      }

      // Insert vendor
      const { data, error } = await supabase
        .from("vendors")
        .insert([{ ...req.body, ...photoUrls }])
        .select();

      if (error) return res.status(400).json({ error: error.message });
      res.json(data[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get All Vendors
app.get("/vendors", async (req, res) => {
  const { data, error } = await supabase.from("vendors").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get Vendor by user_id
app.get("/vendors/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user_id)
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update Vendor
app.put(
  "/vendors/:user_id",
  upload.fields([
    { name: "personal_photo", maxCount: 1 },
    { name: "aadhar_photo", maxCount: 1 },
    { name: "cart_photo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { user_id } = req.params;

      let photoUrls = {};
      if (req.files.personal_photo) {
        photoUrls.personal_photo = await uploadToSupabase(
          req.files.personal_photo[0].buffer,
          "personal.jpg",
          user_id,
          "vendor"
        );
      }
      if (req.files.aadhar_photo) {
        photoUrls.aadhar_photo = await uploadToSupabase(
          req.files.aadhar_photo[0].buffer,
          "aadhar.jpg",
          user_id,
          "vendor"
        );
      }
      if (req.files.cart_photo) {
        photoUrls.cart_photo = await uploadToSupabase(
          req.files.cart_photo[0].buffer,
          "cart.jpg",
          user_id,
          "vendor"
        );
      }

      const { data, error } = await supabase
        .from("vendors")
        .update({ ...req.body, ...photoUrls })
        .eq("user_id", user_id)
        .select();

      if (error) return res.status(400).json({ error: error.message });
      res.json(data[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

//////////////////////////////
// ✅ BANK ACCOUNTS CRUD (with passbook upload)
//////////////////////////////

// Create Bank Account
// ✅ Bank Accounts - Create Bank Account
app.post(
  "/bank-accounts",
  upload.single("passbook_photo"),
  async (req, res) => {
    try {
      const userId = req.body.user_id;
      const accountNumber = req.body.account_number;

      // 🔍 Check for duplicate account_number
      const { data: existingAccount, error: accError } = await supabase
        .from("bank_accounts")
        .select("user_id")
        .eq("account_number", accountNumber)
        .maybeSingle();

      if (accError) return res.status(400).json({ error: accError.message });
      if (existingAccount)
        return res
          .status(400)
          .json({ error: "Account number already exists" });

      // 📂 Upload photo
      let photoUrl = null;
      if (req.file) {
        photoUrl = await uploadToSupabase(
          req.file.buffer,
          "passbook.jpg",
          userId,
          "bank"
        );
      }

      // Insert bank account
      const { data, error } = await supabase
        .from("bank_accounts")
        .insert([{ ...req.body, passbook_photo: photoUrl }])
        .select();

      if (error) return res.status(400).json({ error: error.message });
      res.json(data[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get All Bank Accounts
app.get("/bank-accounts", async (req, res) => {
  const { data, error } = await supabase.from("bank_accounts").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get Bank Account by user_id
app.get("/bank-accounts/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("user_id", user_id)
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update Bank Account
app.put(
  "/bank-accounts/:user_id",
  upload.single("passbook_photo"),
  async (req, res) => {
    try {
      const { user_id } = req.params;
      let photoUrl = null;

      if (req.file) {
        photoUrl = await uploadToSupabase(
          req.file.buffer,
          "passbook.jpg",
          user_id,
          "bank"
        );
      }

      const { data, error } = await supabase
        .from("bank_accounts")
        .update({ ...req.body, ...(photoUrl && { passbook_photo: photoUrl }) })
        .eq("user_id", user_id)
        .select();

      if (error) return res.status(400).json({ error: error.message });
      res.json(data[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default serverless(app);

import express from "express";
import { conn } from "../dbconnect";

import { RowDataPacket } from "mysql2";
import { ResultSetHeader } from "mysql2/promise";


import util from "util";

export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();

// router.get("/" ,(req,res)=>{
//     res.json("folder.ts pages")
// });

router.get("/jae", async (req,res)=>{
    try{
        const sql = 'SELECT d.did,d.file_name,d.file_url,d.semester,d.create_at FROM document_category dc INNER JOIN category c ON dc.category_id = c.category_id INNER JOIN document d ON dc.did = d.did WHERE dc.category_id = 1;';
        const [rows] = await conn.query(sql);
        if ((rows as any[]).length === 0) {
            return res.status(204).json({
                message: `No documents found in category JAE`,
            });
        }
        res.status(200).json({
            category: "JAE",
            count: (rows as any[]).length,
            data: rows,
        });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//แสดงประเภทของ folder
router.get("/:id", async (req,res)=>{
    try{
        const catetogyID = req.params.id;

        if(!catetogyID){
            res.status(400).json({ messeage : "Catetogy ID not found"});
        }

        const sql_category_name =  'SELECT * FROM `category` WHERE category_id = ?';
        const [categoryRows] :any  = await conn.query(sql_category_name,[
            catetogyID
        ]);

        const sql = 'SELECT d.did,d.file_name,d.file_url,d.semester,d.create_at FROM document_category dc INNER JOIN category c ON dc.category_id = c.category_id INNER JOIN document d ON dc.did = d.did WHERE dc.category_id = ? GROUP BY d.did;';
        const [rows] = await conn.query(sql,[
            catetogyID
        ]);

        const categoryName = categoryRows[0]; // ✅ JSON object
        if ((rows as any[]).length === 0) {
            return res.status(204).json({
                message: `No documents found in category '${categoryName}'`,
            });
        }
        res.status(200).json({
            category: categoryName,
            count: (rows as any[]).length,
            data: rows,
        });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});
//add ประเภทของ forlder
router.post("/", async (req,res)=>{
    try{
        const { document_id, categories } = req.body;

    if (
      !document_id ||
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const values = categories.map((catId: number) => [
      document_id,
      catId
    ]);

    const sql = `
      INSERT INTO document_category (did, category_id)
      VALUES ?
    `;

    const [result]: any = await conn.query(sql, [values]);

    res.status(201).json({
      message: "Categories added successfully",
      inserted: result.affectedRows
    });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});


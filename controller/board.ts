import express from "express";
import {conn} from "../dbconnect";
import { ResultSetHeader } from "mysql2/promise";
export const router = express.Router();

//Get board
router.get("/",async (req,res)=>{
    try{
        const [rows] = await conn.query("SELECT * FROM `board` ");
        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//Add board
router.post("/",async(req,res)=>{
    try{
        const { detail , did }= req.body;
        if(!detail || !did){
            return res.status(400).json({ message : "Context failed to send"});
        };
        const sql = 'INSERT INTO `board`( `detail`, `did`) VALUES (?,?)';
        const [rows] = await conn.query<ResultSetHeader>(sql,[
            detail,
            did
        ]); 
        if(rows.affectedRows === 0){
            return res.status(401).json({ message : "No data"})        
        }
        res.status(201).json({ 
            message: "User created",
            row : rows.affectedRows 
        });
 
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

router.get("/send", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM `doc_send`");
    console.log("Rows:", rows);
    res.json({
      count: Array.isArray(rows) ? rows.length : 0,
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});
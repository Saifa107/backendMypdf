import express from "express";
import { conn } from "../dbconnect";

import util from "util";

import { ResultSetHeader } from "mysql2/promise";
import axios from "axios";
import multer from "multer";
import FormData from "form-data";
import { console } from "inspector";


export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();


// router.get("/",(req,res)=>{
//     res.send("Get in document.ts");
// });

router.get("/getAll", async (req,res)=>{
 try{
    const sql = "SELECT * FROM `document`";
    const [rows] = await conn.query(sql);
    res.json(rows);
 }catch(err){
    console.error(err);
    res.status(500).send("Database error");
 }
});

router.get("/",async (req,res)=>{
    try{
        const [rows] = await conn.query("SELECT * FROM `board` ");
        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//หาเฉพาะเอกสารนั้นๆ 
router.get("/getDoc/:id",async(req,res)=>{
    try{
        const document_id = req.params.id;
      
        if(!document_id){
            return res.status(400).json({ message : "Documen ID not found"});
        }
        const sql = "SELECT * FROM `document` WHERE did = ?";
        const [rows] : any = await conn.query(sql,[document_id]);
        
        if (rows.length === 0) {
          return res.status(204).json({ message: "Document not found" });
        }

        res.status(200).json({
          message : "successful",
          rows : rows
        });

    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//ลบเอกสาร
router.delete("/:id",async(req,res)=>{
    try{
        const document_id = req.params.id;
        if(!document_id){
            return res.status(400).json({ message : "Document ID not found"});
        }
        const sql = "DELETE FROM document WHERE `did` = ?";
        const [rows] = await conn.query<ResultSetHeader>(sql,[document_id]);
        if(rows.affectedRows === 0){
            return res.status(204).json({message : "Document not found"});
        }
        res.status(201).json({ 
            massage : "Delete document ",
            rows : rows.affectedRows
        });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//ปฏิทิน
router.post("/date",async(req,res)=>{
    try{
        const {date} = req.body;

        if(!date){
            return res.status(400).json({ message : "Date failed to send"});
        }

        const sql = "SELECT * FROM `document` WHERE DATE(create_at) = ?";
        const [rows] = await conn.query(sql,[date]);

        res.status(201).json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//แสดงเอกสารเพฉาะอาจาร์แต่ละคน
router.post("/home/:uid",async(req,res)=>{
    try{
        const user_id  = req.params.uid;

        if(!user_id){
            return res.status(400).json({ message : "User ID failed to send"});
        }

        const sql = "select document.did,document.file_url,doc_send.title,doc_send.create_at,doc_send.uid from document inner join doc_send ON document.did = doc_send.did WHERE doc_send.uid = ?";
        const [rows] = await conn.query(sql,[user_id]);

        res.status(201).json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//แสดงเอกสารเพฉาะอาจาร์แต่ละคน + ช่วง 1 
router.post("/term1/:id",async(req,res)=>{
    try{
        const user_id = req.params.id;

        if(!user_id){
            return res.status(400).json({ message : "User ID failed to send"});
        }

        const sql  = "select document.did,document.file_url,document.semester,doc_send.title,doc_send.create_at,doc_send.uid from document inner join doc_send ON document.did = doc_send.did WHERE doc_send.uid = ? AND document.semester LIKE '%-1';";
        const [rows] : any = await conn.query(sql,[user_id]);

        if(rows.length === 0){
            return res.status(204).json({ message : "No documents found" ,
                Data : []});
        }

        res.status(201).json(rows);

    }catch(err){
        console.error(err);
        res.status(500).send("Database error")
    }
});

//แสดงเอกสารเพฉาะอาจาร์แต่ละคน + ช่วง 2
router.post("/term2/:id",async(req,res)=>{
    try{
        const user_id = req.params.id;
        if(!user_id){
            return res.status(400).json({ message : "User ID failed to send"});
        }
        const sql = "select document.did,document.file_url,document.semester,doc_send.title,doc_send.create_at,doc_send.uid from document inner join doc_send ON document.did = doc_send.did WHERE doc_send.uid = ? AND document.semester LIKE '%-2';";
        const [rows] : any = await conn.query(sql,[user_id]);

        if(rows.length === 0){
            return res.status(204).json({ message : "No documents found",
                Data : []
            });
        }
        res.status(201).json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Datadase error");
    }
});
//วันที่ Semester
function getCurrentSemester(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  let semesterYear: number;
  let semester: number;

  if (month >= 6 && month <= 10) {
    // มิ.ย. - ต.ค.
    semester = 1;
    semesterYear = year;
  } else if (month >= 11 && month <= 12) {
    // พ.ย. - ธ.ค.
    semester = 2;
    semesterYear = year;
  } else if (month >= 1 && month <= 4) {
    // ม.ค. - เม.ย. (เป็นเทอม 2 ของปีก่อน)
    semester = 2;
    semesterYear = year - 1;
  } else {
    // พ.ค. (แล้วแต่ระบบจะกำหนด)
    semester = 1;
    semesterYear = year;
  }

  return `${semesterYear}-${semester}`;
}
//upload
class uploadFile{
    public readonly upload = multer({
            storage: multer.memoryStorage(),
            limits:{
                fileSize: 64 * 1024 * 1024, // 64 MByte
            },
    });
}

const fileUpload = new uploadFile();
router.post("/upload", fileUpload.upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // 🔹 project_id (อาจมาจาก token / db / body ก็ได้)
      const projectId = 'https://cdn.csmsu.net/extproj_mypdf';

      /* ==============================
         Prepare FormData
      ============================== */
      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      /* ==============================
         Upload to CDN
      ============================== */
      const cdnResponse = await axios.post(
        projectId,
        form,
        {
          headers: {
            ...form.getHeaders(),
            accept: "application/json",
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      const filename = cdnResponse.data.filename;
     
      const url_file = projectId+'/'+filename;
      
      const semester = getCurrentSemester();

      const name = req.file.originalname;
      console.log(req.file.originalname);
      console.log(filename);
      console.log(url_file); 
      //บันทึกลง database
      const sql = 'INSERT INTO `document` (`file_url`,`file_name`, `statue`, `semester`) VALUES (?,?,?,?);';
      const [rows] = await conn.query<ResultSetHeader>(sql,[
        url_file,
        name,
        "0",
        semester
      ]);
      /* ==============================
         Response
      ============================== */
      return res.status(200).json({
        message: "Upload success",
        rows : rows.affectedRows,
        cdn: cdnResponse.data,
      });
    } catch (err: any) {
      console.error(err.response?.data || err.message);

      return res.status(err.response?.status || 500).json({
        message: "Upload failed",
        error: err.response?.data || err.message,
      });
    }
  }
);

//get upload file
router.get("/Filename/:filename", async(req,res)=>{
    try{
        const { filename } = req.params;
        const download = req.query.download === "true";

        const cdnUrl = `https://cdn.csmsu.net/extproj_mypdf/${filename}`;

        if (download) {
        // บังคับ download
            return res.redirect(
                cdnUrl + "?response-content-disposition=attachment"
            );
        }

        // preview
        return res.redirect(cdnUrl);
    }catch(err){
        console.error(err);
        res.status(500).send("Datadase error");
    }
});

//get upload file (id)
router.get("/:id",async(req,res)=>{
    try{
        const document_id = req.params.id;
        const download = req.query.download === "true";

        if(!document_id){
            return res.status(400).json({ message : "Documen ID not found"});
        }
        const sql = "SELECT * FROM `document` WHERE did = ?";
        const [rows] : any = await conn.query(sql,[document_id]);
        
        if (rows.length === 0) {
          return res.status(404).json({ message: "Document not found" });
        }

        const cdnUrl = rows[0].file_url;
      
        if (download) {
        // บังคับ download
            return res.redirect(
                cdnUrl + "?response-content-disposition=attachment"
            );
        }
        // preview
        return res.redirect(cdnUrl);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//ส่งเอกสารให้ อาจาร์แต่ละคน
router.post("/docSend/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { file_id } = req.body;

    if (!id || !file_id) {
      return res.status(400).json({ message: "id or file_id missing" });
    }

    const sql = `
      INSERT INTO doc_send (title, uid, did)
      VALUES (?, ?, ?)
    `;
    const [rows] = await conn.query<ResultSetHeader>(sql, [
      "test1",
      id,
      file_id,
    ]);

    const sqlUpstatus = `
      UPDATE document SET statue = 1 WHERE did = ?
    `;
    const [UpStatus] = await conn.query<ResultSetHeader>(sqlUpstatus, [
      file_id,
    ]);

    if (rows.affectedRows === 0 || UpStatus.affectedRows === 0) {
      return res.status(400).json({ message: "Insert or Update failed" });
    }

    res.status(200).json({
      message: "Insert successful and document status updated",
      send_rows: rows.affectedRows,
      update_rows: UpStatus.affectedRows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Datadase error");
  }
});
 


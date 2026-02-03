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

router.get("/noBoard", async (req, res) => {
  try {
    // แก้ไข SQL: Join ทั้ง board และ quality_document
    // แล้วเลือกเฉพาะแถวที่หาไม่เจอในทั้ง 2 ตาราง (IS NULL ทั้งคู่)
    const sql = `
      SELECT d.* FROM document d
      LEFT JOIN board b ON d.did = b.did
      LEFT JOIN quality_document q ON d.did = q.did
      WHERE b.did IS NULL 
      AND q.did IS NULL;
    `;
    
    const [rows] = await conn.query(sql);
    res.json(rows);
    
  } catch (err) {
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

//////////////////// quality //////////////////////
////////////////////////////////////////////////////
router.get("/quality", async (req, res) => {
    try {
        const sql = 'SELECT * FROM `quality`';
        const [rows] = await conn.query(sql);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});

// upload ลง quality
router.post("/quality", async (req,res)=>{
  try{
    const {qid , did} = req.body;
    if (!qid || !did) {
      return res.status(400).json({
        message: "กรุณาระบุ qid และ did",
        received: req.body
      });
    }
    const sql = 'INSERT INTO `quality_document` ( `qid`, `did`) VALUES ( ?, ?);';
    const [rows] = await conn.query<ResultSetHeader>(sql, [
      qid,
      did
    ]);
    if (rows.affectedRows === 0) {
      return res.status(500).json({ message: "Insert failed" });
    }

    res.status(201).json({
      message: "Quality created successfully",
      quality : rows.insertId,
      affectedRows: rows.affectedRows
    });
  }catch(err){
    console.error(err);
    res.status(500).send("Database error");
  }
});

//สร้าง folder ประกันคุณภาพ
router.post("/Addquality" , async(req,res)=>{
  try{
    const { name } = req.body;
    if(!name){
      return res.status(400).json({
        message: "ไม่มีข้อมูลถูกส่งมา",
      });
    }
    const sql = 'INSERT INTO `quality`( `q_name`) VALUES (?)';
    const [rows] = await conn.query<ResultSetHeader>(sql,[
      name
    ]);
    res.status(201).json({ message: "Quality created",row : rows.affectedRows });
  }catch(err){
    console.error(err);
    res.status(500).send("Database error");
  }
});

//แสดง file ใน folder นั้นๆ
router.get("/qualityFiles/:id", async (req, res) => {
  try {
    const qid = req.params.id; // รับค่า qid จาก URL

    if (!qid) {
      return res.status(400).json({ message: "Quality ID required" });
    }

    // SQL: เลือกข้อมูลจากตาราง document โดยเชื่อมกับ quality_document
    // เงื่อนไขคือ quality_document.qid ต้องตรงกับที่ส่งมา
    const sql = `
      SELECT document.did, document.file_url, document.statue, document.semester, document.create_at, document.file_name
      FROM document
      INNER JOIN quality_document ON document.did = quality_document.did
      WHERE quality_document.qid = ?
    `;

    const [rows] = await conn.query(sql, [qid]);

    // ถ้าไม่มีข้อมูล ส่ง array ว่างกลับไป (200 OK)
    res.status(200).json(rows);

  } catch (err) {
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
router.delete("/:id", async (req, res) => {
  try {
    const document_id = req.params.id;
    if (!document_id) {
      return res.status(400).json({ message: "Document ID not found" });
    }

    // 1️⃣ ลบ doc_send
    const [docSendResult] = await conn.query<ResultSetHeader>(
      "DELETE FROM `doc_send` WHERE did = ?",
      [document_id]
    );

    // 2️⃣ ลบ document_category
    const [docCategoryResult] = await conn.query<ResultSetHeader>(
      "DELETE FROM `document_category` WHERE did = ?",
      [document_id]
    );

    // 3️⃣ ลบ document
    const [docResult] = await conn.query<ResultSetHeader>(
      "DELETE FROM `document` WHERE did = ?",
      [document_id]
    );

    if (docResult.affectedRows === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.status(200).json({
      message: "Delete document success",
      doc_send_deleted: docSendResult.affectedRows,
      document_category_deleted: docCategoryResult.affectedRows,
      document_deleted: docResult.affectedRows
    });

  } catch (err) {
    console.error("DELETE ERROR:", err);
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

// ดึง Title จากตาราง doc_send โดยใช้ did (เอามาแค่ 1 ตัว)
router.get("/getDocTitle/:id", async (req, res) => {
  try {
    const did = req.params.id;

    if (!did) {
      return res.status(400).json({ message: "File ID is required" });
    }

    // SQL: เลือก title จาก doc_send ที่ did ตรงกัน
    // LIMIT 1 = เอามาแค่แถวเดียว (เพราะ title มักจะเหมือนกันถ้าเป็นไฟล์เดียวกัน หรือเอาตัวแรกที่เจอ)
    const sql = "SELECT title FROM doc_send WHERE did = ? LIMIT 1";
    
    // หรือถ้าต้องการค่าที่ไม่ซ้ำจริงๆ ในกรณีที่มีหลาย Title ให้ใช้ DISTINCT
    // const sql = "SELECT DISTINCT title FROM doc_send WHERE did = ? LIMIT 1";

    const [rows]: any = await conn.query(sql, [did]);

    if (rows.length > 0) {
      res.status(200).json({ title: rows[0].title });
    } else {
      // กรณีไม่เคยถูกส่ง (ไม่มีใน doc_send) ให้ส่งค่าว่างหรือ null กลับไป
      res.status(200).json({ title: null }); 
    }

  } catch (err) {
    console.error("Error getting doc title:", err);
    res.status(500).send("Database error");
  }
});

// ดึงรายละเอียดการส่งเอกสาร (Title, Teachers, Categories) จาก did
router.get("/getSendDetails/:did", async (req, res) => {
  try {
    const did = req.params.did;
    if (!did) {
      return res.status(400).json({ message: "Document ID is required" });
    }

    // 1. หา Title (หัวข้อ) จาก doc_send (เอาแค่ 1 ตัว เพราะทุก row ของ did เดียวกัน title จะเหมือนกัน)
    const sqlTitle = "SELECT title FROM doc_send WHERE did = ? LIMIT 1";
    
    // 2. หา Teacher IDs (uid) ที่ถูกส่งไป
    const sqlTeachers = "SELECT uid FROM doc_send WHERE did = ?";

    // 3. หา Category IDs ที่ถูกเลือก
    const sqlCategories = "SELECT category_id FROM document_category WHERE did = ?";

    // รัน Query พร้อมกันด้วย Promise.all เพื่อความเร็ว
    const [titleRows, teacherRows, categoryRows] : any = await Promise.all([
      conn.query(sqlTitle, [did]),
      conn.query(sqlTeachers, [did]),
      conn.query(sqlCategories, [did])
    ]);

    // จัดรูปแบบข้อมูลก่อนส่งกลับ
    const responseData = {
      // ถ้าไม่มี title (ยังไม่เคยส่ง) ให้เป็นค่าว่าง
      title: titleRows[0].length > 0 ? titleRows[0][0].title : "", 
      
      // แปลงจาก Array of Objects [{uid: 1}, {uid: 2}] -> Array of Numbers [1, 2]
      teacher_ids: teacherRows[0].map((row: any) => row.uid),
      
      // แปลงจาก Array of Objects [{category_id: 1}] -> Array of Numbers [1]
      category_ids: categoryRows[0].map((row: any) => row.category_id)
    };

    res.status(200).json(responseData);

  } catch (err) {
    console.error("Error getting send details:", err);
    res.status(500).send("Database error");
  }
});

//แสดงเอกสารเพฉาะอาจาร์แต่ละคน
router.get("/home/:uid",async(req,res)=>{
    try{
        const user_id  = req.params.uid;

        if(!user_id){
            return res.status(400).json({ message : "User ID failed to send"});
        }

        const sql = "select document.did,document.file_url,doc_send.title,doc_send.create_at,doc_send.uid,document.file_name from document inner join doc_send ON document.did = doc_send.did WHERE doc_send.uid = ?";
        const [rows] = await conn.query(sql,[user_id]);

        res.status(201).json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//แสดงเอกสารเพฉาะอาจาร์แต่ละคน + ช่วง 1 
router.get("/term1/:id",async(req,res)=>{
    try{
        const user_id = req.params.id;

        if(!user_id){
            return res.status(400).json({ message : "User ID failed to send"});
        }

        const sql  = "select document.did,document.file_url,document.semester,doc_send.title,doc_send.create_at,doc_send.uid,document.file_name from document inner join doc_send ON document.did = doc_send.did WHERE doc_send.uid = ? AND document.semester LIKE '%-1';";
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
router.get("/term2/:id",async(req,res)=>{
    try{
        const user_id = req.params.id;
        if(!user_id){
            return res.status(400).json({ message : "User ID failed to send"});
        }
        const sql = "select document.did,document.file_url,document.semester,doc_send.title,doc_send.create_at,doc_send.uid,document.file_name from document inner join doc_send ON document.did = doc_send.did WHERE doc_send.uid = ? AND document.semester LIKE '%-2';";
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
      // ลองแปลง encoding ถ้าชื่อไฟล์เป็น latin1

      let originalFileName = req.file.originalname;
      try {
        originalFileName = Buffer.from(originalFileName, 'latin1').toString('utf8');
      } catch (e) {
        console.log('Cannot decode filename, using original');
      }
      console.log(req.file.originalname);
      console.log(filename);
      console.log(url_file); 
      //บันทึกลง database
      const sql = 'INSERT INTO `document` (`file_url`,`file_name`, `statue`, `semester`) VALUES (?,?,?,?);';
      const [rows] = await conn.query<ResultSetHeader>(sql,[
        url_file,
        originalFileName,
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

// upload + add board
router.post("/upload-board", fileUpload.upload.single("file"), async (req, res) => {
    try {
      const { detail , headers } = req.body;

      if (!req.file || !detail || !headers) {
        return res.status(400).json({
          message: "file หรือ detail หายไป"
        });
      }

      /* ==========================
         1. Upload ไป CDN
      ========================== */
      const projectId = "https://cdn.csmsu.net/extproj_mypdf";

      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const cdnResponse = await axios.post(projectId, form, {
        headers: {
          ...form.getHeaders(),
          accept: "application/json",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const filename = cdnResponse.data.filename;
      const fileUrl = `${projectId}/${filename}`;

      /* ==========================
         2. แก้ encoding ชื่อไฟล์
      ========================== */
      let originalFileName = req.file.originalname;
      try {
        originalFileName = Buffer
          .from(originalFileName, "latin1")
          .toString("utf8");
      } catch {}

      const semester = getCurrentSemester();

      /* ==========================
         3. INSERT document
      ========================== */
      const [docResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO document (file_url, file_name, statue, semester)
         VALUES (?, ?, ?, ?)`,
        [fileUrl, originalFileName, "0", semester]
      );

      const did = docResult.insertId; // ⭐ สำคัญมาก

      /* ==========================
         4. INSERT board
      ========================== */
      const [boardResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO board (detail, did, harder)
         VALUES (?, ?, ?)`,
        [detail, did, headers]
      );

      /* ==========================
         Response
      ========================== */
      res.status(201).json({
        message: "Upload + Create Board success",
        did,
        boardId: boardResult.insertId,
        file_url: fileUrl,
      });

    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Upload board failed",
        error: err.message
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




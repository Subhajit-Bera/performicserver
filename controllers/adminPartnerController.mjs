// import pool from '../config/db.mjs';

// export const getAllPartnersAdmin = async (req, res) => {
//     try {
//         const result = await pool.query('SELECT * FROM partners ORDER BY name');
//         res.json(result.rows);
//     } catch (err) { res.status(500).json({ message: "Error fetching partners" }); }
// };

// export const createPartner = async (req, res) => {
//     const { name, location, featured_text, logo_url, link_stream_slug, link_city_slug } = req.body;
//     try {
//         const result = await pool.query(
//             'INSERT INTO partners (name, location, featured_text, logo_url, link_stream_slug, link_city_slug) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
//             [name, location, featured_text, logo_url, link_stream_slug, link_city_slug]
//         );
//         res.status(201).json(result.rows[0]);
//     } catch (err) { res.status(500).json({ message: "Error creating partner" }); }
// };

// export const updatePartner = async (req, res) => {
//     const { id } = req.params;
//     const { name, location, featured_text, logo_url, link_stream_slug, link_city_slug } = req.body;
//     try {
//         const result = await pool.query(
//             'UPDATE partners SET name=$1, location=$2, featured_text=$3, logo_url=$4, link_stream_slug=$5, link_city_slug=$6 WHERE id=$7 RETURNING *',
//             [name, location, featured_text, logo_url, link_stream_slug, link_city_slug, id]
//         );
//         res.json(result.rows[0]);
//     } catch (err) { res.status(500).json({ message: "Error updating partner" }); }
// };

// export const deletePartner = async (req, res) => {
//     const { id } = req.params;
//     try {
//         await pool.query('DELETE FROM partners WHERE id=$1', [id]);
//         res.status(204).send();
//     } catch (err) { res.status(500).json({ message: "Error deleting partner" }); }
// };


import pool from '../config/db.mjs';

export const getAllPartnersAdmin = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM partners ORDER BY name');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: "Error fetching partners" }); }
};

export const createPartner = async (req, res) => {
    const { name, location, featured_text, logo_url, link_stream_slug, link_city_slug } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO partners (name, location, featured_text, logo_url, link_stream_slug, link_city_slug) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, location, featured_text, logo_url, link_stream_slug, link_city_slug]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ message: "Error creating partner" }); }
};

export const updatePartner = async (req, res) => {
    const { id } = req.params;
    const { name, location, featured_text, logo_url, link_stream_slug, link_city_slug } = req.body;
    try {
        const result = await pool.query(
            'UPDATE partners SET name=$1, location=$2, featured_text=$3, logo_url=$4, link_stream_slug=$5, link_city_slug=$6 WHERE id=$7 RETURNING *',
            [name, location, featured_text, logo_url, link_stream_slug, link_city_slug, id]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ message: "Error updating partner" }); }
};

export const deletePartner = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM partners WHERE id=$1', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ message: "Error deleting partner" }); }
};
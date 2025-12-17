export const uploadSuccessFileChunkApi = (fileHash) => axios.get(`http://localhost:8080/message/uploadSuccessFileChunk/${fileHash}`)

export const sendFileChunkApi  = (data, config) => axios.post('http://localhost:8080/message/sendFileChunk', data, config)

export const mergeFileChunkApi = (fileHash, filename) => axios.post(`http://localhost:8080/message/merge?fileHash=${fileHash}&filename=${filename}`)